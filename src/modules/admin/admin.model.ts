import {
  Schema,
  type Connection,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from 'mongoose';

/**
 * `OWNER` does everything; `MODERATOR` handles reports, listings and
 * suspensions, but cannot verify sellers, feature parts or read the log.
 */
export const ADMIN_ROLES = ['OWNER', 'MODERATOR'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/**
 * Someone who runs 3arabity from the dashboard. Kept apart from app users,
 * so nothing an app account can do reaches the dashboard. Made with
 * `npm run admin:create`; there is no sign-up.
 */
const adminSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    fullName: { type: String, required: true, trim: true, maxlength: 100 },
    passwordHash: { type: String, required: true, select: false },
    /** Bumped on every password change, ending the tokens signed before it. */
    passwordVersion: { type: Number, default: 0 },
    role: { type: String, enum: ADMIN_ROLES, required: true },
    active: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true, collection: 'admins' },
);

adminSchema.index({ email: 1 }, { unique: true });

export type Admin = InferSchemaType<typeof adminSchema>;
export type AdminDocument = HydratedDocument<Admin>;
export type AdminModel = Model<Admin>;

export const createAdminModel = (connection: Connection): AdminModel =>
  connection.model<Admin>('Admin', adminSchema);

export const AUDIT_TARGETS = ['USER', 'PART', 'REPORT', 'SETTINGS', 'ANNOUNCEMENT'] as const;

/** One thing an admin did, kept for good: who, what, to what and why. */
const auditSchema = new Schema(
  {
    adminId: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
    /** Kept as it was, in case the admin is renamed or removed. */
    adminEmail: { type: String, required: true },
    action: { type: String, required: true },
    target: { type: String, enum: AUDIT_TARGETS, required: true },
    /** An account, part, report or announcement id; for settings, their name (`support`, `cars`…). */
    targetId: { type: Schema.Types.Mixed, required: true },
    /** What the admin wrote as the reason. */
    note: { type: String, default: null },
    /** What changed, e.g. `{ accountStatus: 'SUSPENDED' }`. */
    changes: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'audit_log' },
);

auditSchema.index({ createdAt: -1 });
auditSchema.index({ targetId: 1, createdAt: -1 });

export type AuditEntry = InferSchemaType<typeof auditSchema>;
export type AuditModel = Model<AuditEntry>;

export const createAuditModel = (connection: Connection): AuditModel =>
  connection.model<AuditEntry>('AuditEntry', auditSchema);
