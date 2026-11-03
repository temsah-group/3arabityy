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

import { notFound } from '../../common/http/errors.js';
import { send } from '../../common/http/response.js';
import { parseBody, parseQuery } from '../../common/http/validate.js';
import type { AdminActor } from '../admin/admin-auth.js';
import type { AuditModel } from '../admin/admin.model.js';
import { pageQuery } from '../admin/admin.schemas.js';
import type {
  NotificationDocument,
  NotificationModel,
} from '../notifications/notification.model.js';
import type { PartModel } from '../parts/part.model.js';
import { AccountStatus, type UserModel } from '../users/user.model.js';

export const AUDIENCES = ['ALL', 'SELLERS'] as const;
export type Audience = (typeof AUDIENCES)[number];

/**
 * A message from 3arabity to its users, written in both languages. It goes
 * to the inbox of every active account in [audience], and with [banner] it
 * also shows on the home screen, to everyone signed in or not, until
 * [bannerUntil] or until it is taken down.
 */
const announcementSchema = new Schema(
  {
    titleAr: { type: String, required: true },
    titleEn: { type: String, required: true },
    bodyAr: { type: String, required: true },
    bodyEn: { type: String, required: true },
    audience: { type: String, enum: AUDIENCES, required: true },
    inbox: { type: Boolean, required: true },
    banner: { type: Boolean, required: true },
    bannerUntil: { type: Date, default: null },
    /** When the banner was taken down early. */
    endedAt: { type: Date, default: null },
    /** How many inboxes it reached. */
    recipients: { type: Number, default: 0 },
    adminId: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
    adminEmail: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'announcements' },
);

announcementSchema.index({ createdAt: -1 });

export type Announcement = InferSchemaType<typeof announcementSchema>;
export type AnnouncementDocument = HydratedDocument<Announcement>;
export type AnnouncementModel = Model<Announcement>;

export const createAnnouncementModel = (connection: Connection): AnnouncementModel =>
  connection.model<Announcement>('Announcement', announcementSchema);

const text = (max: number) =>
  z
    .string('validation.required')
    .trim()
    .min(1, 'validation.required')
    .max(max, 'validation.description');

export const announcementInput = z
  .strictObject({
    titleAr: text(80),
    titleEn: text(80),
    bodyAr: text(500),
    bodyEn: text(500),
    audience: z.enum(AUDIENCES, 'validation.required'),
    inbox: z.boolean('validation.required'),
    banner: z.boolean('validation.required'),
    bannerUntil: z.iso
      .datetime({ offset: true, error: 'validation.query' })
      .nullish()
      .transform((value) => (value ? new Date(value) : null)),
  })
  .refine((input) => input.inbox || input.banner, {
    message: 'validation.required',
    path: ['inbox'],
  })
  .refine((input) => !input.bannerUntil || input.bannerUntil.getTime() > Date.now(), {
    message: 'validation.query',
    path: ['bannerUntil'],
  });
export type AnnouncementInput = z.infer<typeof announcementInput>;

export const announcementsQuery = pageQuery;

/** Inbox messages are written in batches this big. */
const BATCH = 1000;

export class AnnouncementsService {
  constructor(
    private readonly deps: {
      announcements: AnnouncementModel;
      notifications: NotificationModel;
      users: UserModel;
      parts: PartModel;
      audit: AuditModel;
      /** Pushes what was just put in the inboxes. */
      deliver: (items: NotificationDocument[]) => void;
    },
  ) {}

  /** Saves it, then fills the inboxes it is for. */
  async send(actor: AdminActor, input: AnnouncementInput) {
    const { announcements, notifications } = this.deps;
    const announcement = await announcements.create({
      ...input,
      bannerUntil: input.banner ? input.bannerUntil : null,
      adminId: new Types.ObjectId(actor.id),
      adminEmail: actor.email,
    });
    let recipients = 0;
    if (input.inbox) {
      const params = [input.titleAr, input.bodyAr, input.titleEn, input.bodyEn];
      let batch: Types.ObjectId[] = [];
      const flush = async () => {
        if (batch.length === 0) return;
        const items = await notifications.insertMany(
          batch.map((userId) => ({
            userId,
            kind: 'SYSTEM',
            params,
            announcementId: announcement._id,
          })),
          { ordered: false },
        );
        this.deps.deliver(items);
        recipients += batch.length;
        batch = [];
      };
      for await (const user of this.audience(input.audience)) {
        batch.push(user._id);
        if (batch.length >= BATCH) await flush();
      }
      await flush();
      announcement.recipients = recipients;
      await announcement.save();
    }
    await this.log(actor, 'ANNOUNCEMENT_SENT', announcement._id, {
      audience: input.audience,
      inbox: input.inbox,
      banner: input.banner,
      recipients,
    });
    return present(announcement);
  }

  async list(query: z.infer<typeof announcementsQuery>) {
    const { announcements } = this.deps;
    const [found, total] = await Promise.all([
      announcements
        .find()
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.pageSize)
        .limit(query.pageSize)
        .exec(),
      announcements.countDocuments().exec(),
    ]);
    return { items: found.map(present), total, page: query.page, pageSize: query.pageSize };
  }

  /** Takes the banner down; the inbox messages stay. */
  async end(actor: AdminActor, id: string) {
    const announcement = await this.find(id);
    if (announcement.banner && !announcement.endedAt) {
      announcement.endedAt = new Date();
      await announcement.save();
      await this.log(actor, 'ANNOUNCEMENT_ENDED', announcement._id, {});
    }
    return present(announcement);
  }

  /** Gone for good: from the home screen and from every inbox. */
  async remove(actor: AdminActor, id: string): Promise<void> {
    const announcement = await this.find(id);
    await this.deps.notifications.deleteMany({ announcementId: announcement._id }).exec();
    await announcement.deleteOne();
    await this.log(actor, 'ANNOUNCEMENT_REMOVED', announcement._id, {
      titleAr: announcement.titleAr,
    });
  }

  /** The newest banner still up, as the app shows it; null when none is. */
  async banner() {
    const now = new Date();
    const found = await this.deps.announcements
      .findOne({
        banner: true,
        endedAt: null,
        $or: [{ bannerUntil: null }, { bannerUntil: { $gt: now } }],
      })
      .sort({ createdAt: -1 })
      .exec();
    if (!found) return null;
    return {
      id: found.id as string,
      titleAr: found.titleAr,
      titleEn: found.titleEn,
      bodyAr: found.bodyAr,
      bodyEn: found.bodyEn,
      createdAt: found.createdAt,
    };
  }

  /** Active accounts in [audience]; sellers are those with a part listed. */
  private audience(audience: Audience) {
    const active = { accountStatus: { $ne: AccountStatus.SUSPENDED } };
    if (audience === 'ALL') {
      return this.deps.users.find(active).select('_id').lean().cursor();
    }
    const sellers = this.deps.parts.distinct('sellerId');
    return (async function* (users: UserModel) {
      const ids = await sellers.exec();
      yield* users
        .find({ ...active, _id: { $in: ids } })
        .select('_id')
        .lean()
        .cursor();
    })(this.deps.users);
  }

  private async find(id: string): Promise<AnnouncementDocument> {
    const found = Types.ObjectId.isValid(id)
      ? await this.deps.announcements.findById(id).exec()
      : null;
    if (!found) throw notFound('admin.announcementNotFound');
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
      target: 'ANNOUNCEMENT',
      targetId,
      note: null,
      changes,
    });
  }
}

function present(item: AnnouncementDocument) {
  const now = Date.now();
  const live =
    item.banner && !item.endedAt && (!item.bannerUntil || item.bannerUntil.getTime() > now);
  return {
    id: item.id as string,
    titleAr: item.titleAr,
    titleEn: item.titleEn,
    bodyAr: item.bodyAr,
    bodyEn: item.bodyEn,
    audience: item.audience,
    inbox: item.inbox,
    banner: item.banner,
    bannerUntil: item.bannerUntil,
    bannerLive: live,
    endedAt: item.endedAt,
    recipients: item.recipients,
    adminEmail: item.adminEmail,
    createdAt: item.createdAt,
  };
}

/** The dashboard's announcements, under `/admin/announcements`; owners only. */
export function announcementsAdminRoutes(
  announcements: AnnouncementsService,
  owner: RequestHandler,
): Router {
  const router = Router();
  router.use(owner);
  router.get('/', async (req, res) => {
    send(res, { data: await announcements.list(parseQuery(announcementsQuery, req)) });
  });
  router.post('/', async (req, res) => {
    const input = parseBody(announcementInput, req);
    send(res, {
      status: 201,
      message: 'admin.announcementSent',
      data: await announcements.send(req.admin!, input),
    });
  });
  router.post('/:id/end', async (req, res) => {
    send(res, {
      message: 'admin.saved',
      data: await announcements.end(req.admin!, req.params.id as string),
    });
  });
  router.delete('/:id', async (req, res) => {
    await announcements.remove(req.admin!, req.params.id as string);
    res.status(204).end();
  });
  return router;
}
