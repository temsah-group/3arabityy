import { Router, type RequestHandler } from 'express';
import { Schema, type Connection, type InferSchemaType, type Model } from 'mongoose';
import { z } from 'zod';

import { AppError, ErrorCode, notFound } from '../../common/http/errors.js';
import { send } from '../../common/http/response.js';
import { parseBody } from '../../common/http/validate.js';
import type { AdminActor } from '../admin/admin-auth.js';
import type { AuditModel } from '../admin/admin.model.js';
import { phone } from '../auth/auth.schemas.js';
import { DEFAULT_CAR_BRANDS, setCarBrands, type CarBrand } from '../catalog/catalog.js';
import type { PartModel } from '../parts/part.model.js';
import type { UserModel } from '../users/user.model.js';
import defaults from './default-content.json' with { type: 'json' };

/** The texts the app shows that the dashboard edits. */
export const DOCUMENTS = ['terms', 'privacy', 'faq'] as const;
export type DocumentName = (typeof DOCUMENTS)[number];

/**
 * One heading and its text in both languages: a section of the terms or
 * the privacy policy, or a question and answer of the FAQ. `{supportEmail}`
 * in any of them is replaced by the support address when the app shows it.
 */
const sectionSchema = new Schema(
  {
    titleAr: { type: String, required: true },
    titleEn: { type: String, required: true },
    bodyAr: { type: String, required: true },
    bodyEn: { type: String, required: true },
  },
  { _id: false },
);

const documentSchema = new Schema(
  {
    sections: { type: [sectionSchema], default: [] },
    updatedAt: { type: Date, required: true },
  },
  { _id: false },
);

/**
 * What 3arabity says about itself in the app: how to reach support, and
 * the terms, privacy policy and FAQ. One document (`_id: 'app'`); anything
 * never edited is the launch text in `default-content.json`.
 */
const settingsSchema = new Schema(
  {
    _id: { type: String, default: 'app' },
    support: {
      type: new Schema(
        {
          email: { type: String, required: true },
          phone: { type: String, required: true },
          whatsapp: { type: String, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    terms: { type: documentSchema, default: null },
    privacy: { type: documentSchema, default: null },
    faq: { type: documentSchema, default: null },
    /** Car makes and their models, as `carsInput` checks them; null: the launch list. */
    cars: {
      type: new Schema(
        { brands: { type: Schema.Types.Mixed, required: true }, updatedAt: Date },
        { _id: false },
      ),
      default: null,
    },
  },
  { timestamps: true, collection: 'app_settings' },
);

export type Settings = InferSchemaType<typeof settingsSchema>;
export type SettingsModel = Model<Settings>;

export const createSettingsModel = (connection: Connection): SettingsModel =>
  connection.model<Settings>('Settings', settingsSchema);

const text = (max: number) =>
  z
    .string('validation.required')
    .trim()
    .min(1, 'validation.required')
    .max(max, 'validation.description');

export const supportInput = z.strictObject({
  email: z.email('validation.email').max(200, 'validation.email'),
  phone,
  whatsapp: phone,
});

export const documentInput = z.strictObject({
  sections: z
    .array(
      z.strictObject({
        titleAr: text(200),
        titleEn: text(200),
        bodyAr: text(5000),
        bodyEn: text(5000),
      }),
    )
    .min(1, 'validation.required')
    .max(50, 'validation.query'),
});

const code = z
  .string('validation.required')
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{0,39}$/, 'validation.query');
const carName = text(60);
const year = z
  .number('validation.required')
  .int('validation.query')
  .min(1950, 'validation.query')
  .max(new Date().getUTCFullYear() + 2, 'validation.query');

/** Every make with its models; codes are what parts and users' cars keep. */
export const carsInput = z
  .strictObject({
    brands: z
      .array(
        z.strictObject({
          id: code,
          nameAr: carName,
          nameEn: carName,
          models: z
            .array(
              z
                .strictObject({
                  id: code,
                  nameAr: carName,
                  nameEn: carName,
                  fromYear: year,
                  toYear: year.nullable(),
                })
                .refine((model) => model.toYear === null || model.toYear >= model.fromYear, {
                  message: 'validation.query',
                  path: ['toYear'],
                }),
            )
            .min(1, 'validation.required')
            .max(200, 'validation.query'),
        }),
      )
      .min(1, 'validation.required')
      .max(200, 'validation.query'),
  })
  .refine(
    ({ brands }) =>
      new Set(brands.map((brand) => brand.id)).size === brands.length &&
      brands.every((brand) => new Set(brand.models.map((m) => m.id)).size === brand.models.length),
    { message: 'admin.carsDuplicate', path: ['brands'] },
  );

type Section = z.infer<typeof documentInput>['sections'][number];
type Document = { sections: Section[]; updatedAt: Date };

const defaultDocument = (name: DocumentName): Document => ({
  sections: defaults[name],
  updatedAt: new Date(defaults.updatedAt),
});

export class SettingsService {
  constructor(
    private readonly settings: SettingsModel,
    private readonly audit: AuditModel,
    private readonly parts: PartModel,
    private readonly users: UserModel,
  ) {}

  /**
   * Everything the app shows, edited or not. Reading it also puts the saved
   * cars in use, so every server catches up with an owner's edit.
   */
  async current() {
    const stored = await this.settings.findById('app').lean().exec();
    const cars = (stored?.cars?.brands as CarBrand[] | undefined) ?? null;
    setCarBrands(cars);
    const documentOf = (name: DocumentName): Document => {
      const saved = stored?.[name];
      return saved?.sections?.length
        ? { sections: saved.sections as Section[], updatedAt: saved.updatedAt }
        : defaultDocument(name);
    };
    const support = stored?.support;
    return {
      // Null until an owner sets it; the app then offers no way to reach support.
      support: support
        ? { email: support.email, phone: support.phone, whatsapp: support.whatsapp }
        : null,
      terms: documentOf('terms'),
      privacy: documentOf('privacy'),
      faq: documentOf('faq'),
      cars: {
        brands: cars ?? DEFAULT_CAR_BRANDS,
        updatedAt: stored?.cars?.updatedAt ?? null,
      },
      updatedAt: stored?.updatedAt ?? null,
    };
  }

  /**
   * Replaces the car list. A make or model that parts or users' cars still
   * use cannot go; renaming it or changing its years is fine.
   */
  async updateCars(actor: AdminActor, input: z.infer<typeof carsInput>) {
    const before = (await this.current()).cars.brands;
    const kept = new Set(
      input.brands.flatMap((brand) => brand.models.map((model) => `${brand.id}/${model.id}`)),
    );
    for (const brand of before) {
      for (const model of brand.models) {
        if (kept.has(`${brand.id}/${model.id}`)) continue;
        const pair = { brandId: brand.id, modelId: model.id };
        const [part, user] = await Promise.all([
          this.parts.exists({ fitments: { $elemMatch: pair } }).exec(),
          this.users.exists({ cars: { $elemMatch: pair } }).exec(),
        ]);
        if (part || user) {
          throw new AppError(409, ErrorCode.CARS_IN_USE, 'admin.carsInUse', [
            `${brand.nameAr} ${model.nameAr}`,
          ]);
        }
      }
    }
    await this.settings
      .updateOne(
        { _id: 'app' },
        { $set: { cars: { brands: input.brands, updatedAt: new Date() } } },
        { upsert: true },
      )
      .exec();
    await this.log(actor, 'CARS_UPDATED', 'cars', {
      brands: input.brands.length,
      models: kept.size,
    });
    return this.current();
  }

  async updateSupport(actor: AdminActor, input: z.infer<typeof supportInput>) {
    await this.settings
      .updateOne({ _id: 'app' }, { $set: { support: input } }, { upsert: true })
      .exec();
    await this.log(actor, 'SUPPORT_UPDATED', 'support', input);
    return this.current();
  }

  async updateDocument(
    actor: AdminActor,
    name: DocumentName,
    input: z.infer<typeof documentInput>,
  ) {
    await this.settings
      .updateOne(
        { _id: 'app' },
        { $set: { [name]: { sections: input.sections, updatedAt: new Date() } } },
        { upsert: true },
      )
      .exec();
    await this.log(actor, 'DOCUMENT_UPDATED', name, { sections: input.sections.length });
    return this.current();
  }

  private async log(actor: AdminActor, action: string, targetId: string, changes: object) {
    await this.audit.create({
      adminId: actor.id,
      adminEmail: actor.email,
      action,
      target: 'SETTINGS',
      targetId,
      note: null,
      changes,
    });
  }
}

/**
 * `GET /app-config`: public, read by the app on launch. With [banner], the
 * announcement shown on the home screen, if one is up.
 */
export function appConfigRoutes(
  settings: SettingsService,
  banner: () => Promise<object | null>,
): Router {
  const router = Router();
  router.get('/', async (_req, res) => {
    // A few minutes stale is fine; it changes rarely.
    res.setHeader('Cache-Control', 'public, max-age=300');
    const [current, announcement] = await Promise.all([settings.current(), banner()]);
    send(res, { data: { ...current, announcement } });
  });
  return router;
}

/** The dashboard's settings, mounted under `/admin/settings`; owners only. */
export function settingsAdminRoutes(settings: SettingsService, owner: RequestHandler): Router {
  const router = Router();
  router.use(owner);
  router.get('/', async (_req, res) => {
    send(res, { data: await settings.current() });
  });
  router.put('/support', async (req, res) => {
    const input = parseBody(supportInput, req);
    send(res, { message: 'admin.saved', data: await settings.updateSupport(req.admin!, input) });
  });
  router.put('/cars', async (req, res) => {
    const input = parseBody(carsInput, req);
    send(res, { message: 'admin.saved', data: await settings.updateCars(req.admin!, input) });
  });
  router.put('/documents/:name', async (req, res) => {
    const name = req.params.name as DocumentName;
    if (!DOCUMENTS.includes(name)) throw notFound();
    const input = parseBody(documentInput, req);
    send(res, {
      message: 'admin.saved',
      data: await settings.updateDocument(req.admin!, name, input),
    });
  });
  return router;
}
