import { Router, type RequestHandler } from 'express';
import { Schema, type Connection, type InferSchemaType, type Model } from 'mongoose';
import { z } from 'zod';

import { notFound } from '../../common/http/errors.js';
import { send } from '../../common/http/response.js';
import { parseBody } from '../../common/http/validate.js';
import type { AdminActor } from '../admin/admin-auth.js';
import type { AuditModel } from '../admin/admin.model.js';
import { phone } from '../auth/auth.schemas.js';
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
  },
  { timestamps: true, collection: 'app_settings' },
);

export type Settings = InferSchemaType<typeof settingsSchema>;
export type SettingsModel = Model<Settings>;

export const createSettingsModel = (connection: Connection): SettingsModel =>
  connection.model<Settings>('Settings', settingsSchema);

/** Until the dashboard sets real ones. */
export const DEFAULT_SUPPORT = {
  email: 'support@3arabity.com',
  phone: '+201000000000',
  whatsapp: '+201000000000',
};

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
  ) {}

  /** Everything the app shows, edited or not. */
  async current() {
    const stored = await this.settings.findById('app').lean().exec();
    const documentOf = (name: DocumentName): Document => {
      const saved = stored?.[name];
      return saved?.sections?.length
        ? { sections: saved.sections as Section[], updatedAt: saved.updatedAt }
        : defaultDocument(name);
    };
    const support = stored?.support;
    return {
      support: support
        ? { email: support.email, phone: support.phone, whatsapp: support.whatsapp }
        : DEFAULT_SUPPORT,
      terms: documentOf('terms'),
      privacy: documentOf('privacy'),
      faq: documentOf('faq'),
      updatedAt: stored?.updatedAt ?? null,
    };
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

/** `GET /app-config`: public, read by the app on launch. */
export function appConfigRoutes(settings: SettingsService): Router {
  const router = Router();
  router.get('/', async (_req, res) => {
    // A few minutes stale is fine; it changes rarely.
    res.setHeader('Cache-Control', 'public, max-age=300');
    send(res, { data: await settings.current() });
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
