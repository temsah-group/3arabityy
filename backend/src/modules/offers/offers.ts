import { Router, type RequestHandler } from 'express';
import {
  Schema,
  Types,
  type Connection,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from 'mongoose';
import { z } from 'zod';

import { badRequest, ErrorCode, notFound } from '../../common/http/errors.js';
import { send } from '../../common/http/response.js';
import { parseBody } from '../../common/http/validate.js';
import type { AdminActor } from '../admin/admin-auth.js';
import type { AuditModel } from '../admin/admin.model.js';
import { PART_CONDITIONS } from '../catalog/catalog.js';
import { photoUpload } from '../parts/parts.routes.js';
import { photoExtension, type PhotoStorage } from '../users/photo-storage.js';

/** At most this many slides reach the app. */
export const MAX_LIVE_OFFERS = 10;

/**
 * One slide of the home screen's offers, written in both languages. Shown
 * while [active] and until [endsAt]; slides come in [order]. Tapping one
 * switches the home to [condition]'s parts, when it has one.
 */
const offerSchema = new Schema(
  {
    tagAr: { type: String, required: true },
    tagEn: { type: String, required: true },
    titleAr: { type: String, required: true },
    titleEn: { type: String, required: true },
    subtitleAr: { type: String, default: '' },
    subtitleEn: { type: String, default: '' },
    /** A photo uploaded from the dashboard, `/uploads/offers/…`. */
    image: { type: String, required: true },
    condition: { type: String, enum: [...PART_CONDITIONS, null], default: null },
    active: { type: Boolean, default: true },
    endsAt: { type: Date, default: null },
    order: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'offers' },
);

offerSchema.index({ order: 1, createdAt: -1 });

export type Offer = InferSchemaType<typeof offerSchema>;
export type OfferDocument = HydratedDocument<Offer>;
export type OfferModel = Model<Offer>;

export const createOfferModel = (connection: Connection): OfferModel =>
  connection.model<Offer>('Offer', offerSchema);

const text = (max: number) =>
  z
    .string('validation.required')
    .trim()
    .min(1, 'validation.required')
    .max(max, 'validation.description');
const optionalText = (max: number) =>
  z.string('validation.required').trim().max(max, 'validation.description');

const fields = {
  tagAr: text(24),
  tagEn: text(24),
  titleAr: text(60),
  titleEn: text(60),
  subtitleAr: optionalText(90),
  subtitleEn: optionalText(90),
  image: z.string('validation.required').regex(/^\/uploads\/offers\/[\w-]+\.(?:jpg|png|webp)$/, {
    error: 'validation.required',
  }),
  condition: z.enum(PART_CONDITIONS, 'validation.required').nullable(),
  active: z.boolean('validation.required'),
  endsAt: z.iso
    .datetime({ offset: true, error: 'validation.query' })
    .nullable()
    .transform((value) => (value ? new Date(value) : null)),
};

export const offerInput = z.strictObject({
  ...fields,
  subtitleAr: fields.subtitleAr.default(''),
  subtitleEn: fields.subtitleEn.default(''),
  condition: fields.condition.default(null),
  active: fields.active.default(true),
  endsAt: fields.endsAt.default(null),
});
export type OfferInput = z.infer<typeof offerInput>;

export const offerUpdate = z.strictObject(fields).partial();
export type OfferUpdate = z.infer<typeof offerUpdate>;

export const offerOrder = z.strictObject({
  ids: z.array(z.string('validation.required')).max(100, 'validation.query'),
});

export class OffersService {
  constructor(
    private readonly deps: {
      offers: OfferModel;
      audit: AuditModel;
      photos: PhotoStorage;
    },
  ) {}

  /** Every slide, as the dashboard orders them. */
  async list() {
    const found = await this.deps.offers.find().sort({ order: 1, createdAt: -1 }).exec();
    return { items: found.map(present) };
  }

  async uploadPhoto(bytes: Buffer, extension: string): Promise<string> {
    return this.deps.photos.save('offers', bytes, extension);
  }

  /** New slides go first. */
  async create(actor: AdminActor, input: OfferInput) {
    const first = await this.deps.offers.findOne().sort({ order: 1 }).exec();
    const offer = await this.deps.offers.create({ ...input, order: (first?.order ?? 0) - 1 });
    await this.log(actor, 'OFFER_CREATED', offer._id, { titleAr: offer.titleAr });
    return present(offer);
  }

  async update(actor: AdminActor, id: string, input: OfferUpdate) {
    const offer = await this.find(id);
    const oldImage = offer.image;
    offer.set(input);
    await offer.save();
    if (input.image && input.image !== oldImage) await this.deps.photos.remove(oldImage);
    await this.log(actor, 'OFFER_UPDATED', offer._id, { fields: Object.keys(input) });
    return present(offer);
  }

  /** [ids] first to last; slides not named keep their place after them. */
  async reorder(actor: AdminActor, ids: string[]) {
    const valid = ids.filter((id) => Types.ObjectId.isValid(id));
    await Promise.all(
      valid.map((id, index) =>
        this.deps.offers.updateOne({ _id: new Types.ObjectId(id) }, { order: index }).exec(),
      ),
    );
    await this.deps.audit.create({
      adminId: new Types.ObjectId(actor.id),
      adminEmail: actor.email,
      action: 'OFFERS_REORDERED',
      target: 'OFFER',
      targetId: 'order',
      note: null,
      changes: { ids: valid },
    });
    return this.list();
  }

  async remove(actor: AdminActor, id: string): Promise<void> {
    const offer = await this.find(id);
    await offer.deleteOne();
    await this.deps.photos.remove(offer.image);
    await this.log(actor, 'OFFER_REMOVED', offer._id, { titleAr: offer.titleAr });
  }

  /** The slides the app shows now, in order. */
  async live() {
    const found = await this.deps.offers
      .find({ active: true, $or: [{ endsAt: null }, { endsAt: { $gt: new Date() } }] })
      .sort({ order: 1, createdAt: -1 })
      .limit(MAX_LIVE_OFFERS)
      .exec();
    return found.map((offer) => ({
      id: offer.id as string,
      tagAr: offer.tagAr,
      tagEn: offer.tagEn,
      titleAr: offer.titleAr,
      titleEn: offer.titleEn,
      subtitleAr: offer.subtitleAr,
      subtitleEn: offer.subtitleEn,
      image: offer.image,
      condition: offer.condition ?? null,
    }));
  }

  private async find(id: string): Promise<OfferDocument> {
    const found = Types.ObjectId.isValid(id) ? await this.deps.offers.findById(id).exec() : null;
    if (!found) throw notFound('admin.offerNotFound');
    return found;
  }

  private async log(
    actor: AdminActor,
    action: string,
    targetId: Types.ObjectId,
    changes: Record<string, unknown>,
  ) {
    await this.deps.audit.create({
      adminId: new Types.ObjectId(actor.id),
      adminEmail: actor.email,
      action,
      target: 'OFFER',
      targetId,
      note: null,
      changes,
    });
  }
}

function present(offer: OfferDocument) {
  const live = offer.active && (!offer.endsAt || offer.endsAt.getTime() > Date.now());
  return {
    id: offer.id as string,
    tagAr: offer.tagAr,
    tagEn: offer.tagEn,
    titleAr: offer.titleAr,
    titleEn: offer.titleEn,
    subtitleAr: offer.subtitleAr,
    subtitleEn: offer.subtitleEn,
    image: offer.image,
    condition: offer.condition ?? null,
    active: offer.active,
    endsAt: offer.endsAt,
    live,
    order: offer.order,
    createdAt: offer.createdAt,
  };
}

/** The home screen's offers, under `/admin/offers`; owners only. */
export function offersAdminRoutes(offers: OffersService, owner: RequestHandler): Router {
  const router = Router();
  router.use(owner);
  router.get('/', async (_req, res) => {
    send(res, { data: await offers.list() });
  });
  router.post('/photo', photoUpload, async (req, res) => {
    const file = req.file;
    if (!file) throw badRequest(ErrorCode.PHOTO_REQUIRED, 'users.photoRequired');
    const extension = photoExtension(file.buffer);
    if (!extension) throw badRequest(ErrorCode.PHOTO_INVALID, 'users.photoInvalid');
    send(res, { status: 201, data: { path: await offers.uploadPhoto(file.buffer, extension) } });
  });
  router.post('/', async (req, res) => {
    const input = parseBody(offerInput, req);
    send(res, {
      status: 201,
      message: 'admin.saved',
      data: await offers.create(req.admin!, input),
    });
  });
  router.put('/order', async (req, res) => {
    const { ids } = parseBody(offerOrder, req);
    send(res, { message: 'admin.saved', data: await offers.reorder(req.admin!, ids) });
  });
  router.patch('/:id', async (req, res) => {
    const input = parseBody(offerUpdate, req);
    send(res, {
      message: 'admin.saved',
      data: await offers.update(req.admin!, req.params.id as string, input),
    });
  });
  router.delete('/:id', async (req, res) => {
    await offers.remove(req.admin!, req.params.id as string);
    res.status(204).end();
  });
  return router;
}
