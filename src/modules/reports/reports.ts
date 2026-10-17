import { Router, type RequestHandler } from 'express';
import { Schema, Types, type Connection, type InferSchemaType, type Model, mongo } from 'mongoose';
import { z } from 'zod';

import { AppError, badRequest, conflict, ErrorCode } from '../../common/http/errors.js';
import { send } from '../../common/http/response.js';
import { parseBody } from '../../common/http/validate.js';
import { limit } from '../../middleware/rate-limit.js';
import type { PartModel } from '../parts/part.model.js';
import type { UserModel } from '../users/user.model.js';

export const REPORT_TARGETS = ['PART', 'SELLER'] as const;
export const REPORT_REASONS = [
  'FAKE',
  'WRONG_INFO',
  'COUNTERFEIT',
  'STOLEN',
  'SCAM',
  'UNREACHABLE',
  'ABUSIVE',
  'OTHER',
] as const;

/** What a moderator did about a target's reports. */
export const REPORT_ACTIONS = ['DISMISS', 'HIDE_PART', 'REMOVE_PART', 'SUSPEND_SELLER'] as const;
export type ReportAction = (typeof REPORT_ACTIONS)[number];

/** Which reasons suit which target (the app's `ReportReason.targets`). */
const REASONS_FOR: Record<(typeof REPORT_TARGETS)[number], readonly string[]> = {
  PART: ['FAKE', 'WRONG_INFO', 'COUNTERFEIT', 'STOLEN', 'SCAM', 'OTHER'],
  SELLER: ['SCAM', 'UNREACHABLE', 'ABUSIVE', 'OTHER'],
};

/** A user's report of a part or a seller, for 3arabity to review. */
const reportSchema = new Schema(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    target: { type: String, enum: REPORT_TARGETS, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, default: null },
    status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN' },
    /** How a moderator closed it, from the dashboard. */
    resolution: {
      type: new Schema(
        {
          action: { type: String, enum: REPORT_ACTIONS, required: true },
          note: { type: String, default: null },
          adminId: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
          at: { type: Date, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
  },
  { timestamps: true, collection: 'reports' },
);

reportSchema.index({ reporterId: 1, target: 1, targetId: 1 }, { unique: true });
reportSchema.index({ target: 1, targetId: 1, status: 1 });
reportSchema.index({ status: 1, createdAt: -1 });

export type Report = InferSchemaType<typeof reportSchema>;
export type ReportTarget = (typeof REPORT_TARGETS)[number];
export type ReportModel = Model<Report>;

export const createReportModel = (connection: Connection): ReportModel =>
  connection.model<Report>('Report', reportSchema);

export const reportSchemaInput = z
  .strictObject({
    target: z.enum(REPORT_TARGETS, 'validation.required'),
    targetId: z.string('validation.required').max(64, 'validation.required'),
    reason: z.enum(REPORT_REASONS, 'validation.reportReason'),
    details: z
      .string()
      .trim()
      .max(500, 'validation.description')
      .nullish()
      .transform((value) => (value ? value : null)),
  })
  .refine((value) => REASONS_FOR[value.target].includes(value.reason), {
    message: 'validation.reportReason',
    path: ['reason'],
  })
  .refine((value) => value.reason !== 'OTHER' || (value.details?.length ?? 0) >= 5, {
    message: 'validation.reportDetails',
    path: ['details'],
  });

export type ReportInput = z.infer<typeof reportSchemaInput>;

export class ReportsService {
  constructor(
    private readonly reports: ReportModel,
    private readonly parts: PartModel,
    private readonly users: UserModel,
  ) {}

  /** Once per user and target; never the user's own part or self. */
  async create(reporterId: string, input: ReportInput): Promise<void> {
    if (!Types.ObjectId.isValid(input.targetId)) throw this.missing(input.target);
    const ownerId =
      input.target === 'PART'
        ? (await this.parts.findById(input.targetId).select('sellerId').exec())?.sellerId
        : (await this.users.findById(input.targetId).select('_id').exec())?._id;
    if (!ownerId) throw this.missing(input.target);
    if (ownerId.toString() === reporterId) {
      throw badRequest(ErrorCode.CANNOT_REPORT_SELF, 'reports.self');
    }
    try {
      await this.reports.create({
        reporterId: new Types.ObjectId(reporterId),
        target: input.target,
        targetId: new Types.ObjectId(input.targetId),
        reason: input.reason,
        details: input.details,
      });
    } catch (error) {
      if (error instanceof mongo.MongoServerError && error.code === 11000) {
        throw conflict(ErrorCode.ALREADY_REPORTED, 'reports.already');
      }
      throw error;
    }
  }

  async deleteAllOf(userId: string): Promise<void> {
    await this.reports.deleteMany({ reporterId: new Types.ObjectId(userId) }).exec();
  }

  private missing(target: ReportInput['target']): AppError {
    return target === 'PART'
      ? new AppError(404, ErrorCode.PART_NOT_FOUND, 'parts.notFound')
      : new AppError(404, ErrorCode.SELLER_NOT_FOUND, 'sellers.notFound');
  }
}

export function reportsRoutes(reports: ReportsService, requireAuth: RequestHandler): Router {
  const router = Router();
  router.post('/', requireAuth, limit({ max: 20 }), async (req, res) => {
    await reports.create(req.auth!.userId, parseBody(reportSchemaInput, req));
    send(res, { message: 'reports.sent', status: 201 });
  });
  return router;
}
