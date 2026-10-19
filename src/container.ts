import type { Connection } from 'mongoose';

import type { Env } from './config/env.js';
import { authenticate, optionalAuthenticate } from './middleware/authenticate.js';
import { AdminAuthService } from './modules/admin/admin-auth.js';
import { createAdminModel, createAuditModel } from './modules/admin/admin.model.js';
import { ModerationService } from './modules/admin/moderation.service.js';
import {
  AnnouncementsService,
  createAnnouncementModel,
} from './modules/announcements/announcements.js';
import { AuthService } from './modules/auth/auth.service.js';
import { GoogleTokenVerifier, type GoogleVerifier } from './modules/auth/google.js';
import { OtpService } from './modules/auth/otp.service.js';
import { createOtpModel } from './modules/auth/otp.model.js';
import { createRefreshTokenModel } from './modules/auth/session.model.js';
import { SessionsService } from './modules/auth/sessions.service.js';
import { TokenService } from './modules/auth/tokens.js';
import { createMailer, type Mailer } from './modules/mail/mailer.js';
import { createPartModel } from './modules/parts/part.model.js';
import { PartsService } from './modules/parts/parts.service.js';
import { createUploadModel } from './modules/parts/upload.model.js';
import {
  createDeviceModel,
  createNotificationModel,
} from './modules/notifications/notification.model.js';
import { NotificationsService } from './modules/notifications/notifications.service.js';
import { createPushSender, type PushSender } from './modules/notifications/push.js';
import { createReportModel, ReportsService } from './modules/reports/reports.js';
import { createSavedPartModel } from './modules/saved/saved.model.js';
import { SavedService } from './modules/saved/saved.service.js';
import { SellersService } from './modules/sellers/sellers.routes.js';
import { createSettingsModel, SettingsService } from './modules/settings/settings.js';
import { createContactModel, createReviewModel } from './modules/reviews/review.model.js';
import { ReviewsService } from './modules/reviews/reviews.service.js';
import { createShopModel } from './modules/shops/shop.model.js';
import { ShopsService } from './modules/shops/shops.service.js';
import { createUserModel } from './modules/users/user.model.js';
import { AccountService } from './modules/users/account.service.js';
import { PhotoStorage } from './modules/users/photo-storage.js';
import { UsersService } from './modules/users/users.service.js';

/** Builds every service by hand, so dependencies stay visible. Tests swap the mailer. */
export function createContainer(
  connection: Connection,
  env: Env,
  overrides: { mailer?: Mailer; google?: GoogleVerifier; push?: PushSender } = {},
) {
  const models = {
    User: createUserModel(connection),
    RefreshToken: createRefreshTokenModel(connection),
    Otp: createOtpModel(connection),
    Part: createPartModel(connection),
    Upload: createUploadModel(connection),
    SavedPart: createSavedPartModel(connection),
    Notification: createNotificationModel(connection),
    Device: createDeviceModel(connection),
    Report: createReportModel(connection),
    Admin: createAdminModel(connection),
    AuditEntry: createAuditModel(connection),
    Settings: createSettingsModel(connection),
    Announcement: createAnnouncementModel(connection),
    Shop: createShopModel(connection),
    Review: createReviewModel(connection),
    Contact: createContactModel(connection),
  };

  const mailer = overrides.mailer ?? createMailer(env);
  const users = new UsersService(models.User);
  const sessions = new SessionsService(models.RefreshToken);
  const tokens = new TokenService(env);
  const otp = new OtpService(models.Otp, {
    // Its own key derived from the reset secret, never shared with a JWT.
    secret: `otp:${env.JWT_RESET_SECRET}`,
    expiresMinutes: env.OTP_EXPIRES_MINUTES,
    resendSeconds: env.OTP_RESEND_SECONDS,
    maxAttempts: env.OTP_MAX_ATTEMPTS,
  });
  const google =
    overrides.google ??
    (env.GOOGLE_CLIENT_IDS.length > 0 ? new GoogleTokenVerifier(env.GOOGLE_CLIENT_IDS) : null);
  const auth = new AuthService(users, sessions, tokens, otp, mailer, env, google);
  const photos = new PhotoStorage(env.UPLOADS_DIR);
  const notifications = new NotificationsService(
    models.Notification,
    models.Device,
    models.User,
    models.SavedPart,
    overrides.push ?? createPushSender(env),
  );
  const shops = new ShopsService({
    shops: models.Shop,
    parts: models.Part,
    users: models.User,
    audit: models.AuditEntry,
    photos,
    notify: (ownerId, change, shop) => notifications.shopNotice(ownerId, change, shop),
    removed: (shopId) => notifications.shopRemoved(shopId),
  });
  const reviews = new ReviewsService({
    reviews: models.Review,
    contacts: models.Contact,
    parts: models.Part,
    shops: models.Shop,
    users: models.User,
    audit: models.AuditEntry,
    notify: (userId, event, review, name) =>
      notifications.reviewNotice(userId, event, review, name),
  });
  // Set once `saved` exists; parts only call it after a request.
  let saved: SavedService | undefined;
  const parts = new PartsService(
    models.Part,
    models.Upload,
    models.User,
    photos,
    {
      listed: (part) => notifications.partListed(part),
      priceDropped: (part, from) => notifications.priceDropped(part, from),
      removed: async (ids) => {
        await Promise.all([
          saved?.partsRemoved(ids),
          notifications.partsRemoved(ids),
          reviews.partsRemoved(ids),
        ]);
      },
      contacted: (userId, part) => reviews.contacted(userId, part.sellerId, part._id),
    },
    shops,
  );
  saved = new SavedService(models.SavedPart, models.Part, parts);
  const sellers = new SellersService(models.User, models.Part, (id) => shops.openShopIdOf(id));
  const reports = new ReportsService(models.Report, models.Part, models.User, (id) =>
    reviews.authorOf(id),
  );
  // Everything else a deleted account leaves behind goes with it.
  const account = new AccountService(
    users,
    models.User,
    sessions,
    models.Otp,
    photos,
    [parts, saved, notifications, reports, shops, reviews],
    (idToken, googleId) => auth.isGoogleAccount(idToken, googleId),
  );
  const settings = new SettingsService(
    models.Settings,
    models.AuditEntry,
    models.Part,
    models.User,
  );
  const announcements = new AnnouncementsService({
    announcements: models.Announcement,
    notifications: models.Notification,
    users: models.User,
    parts: models.Part,
    audit: models.AuditEntry,
    deliver: (items) => notifications.deliverLater(items),
  });
  const requireAuth = authenticate({ tokens, sessions, users });
  // The dashboard, only when it has a signing key.
  const adminAuth = env.ADMIN_JWT_SECRET
    ? new AdminAuthService(models.Admin, {
        secret: env.ADMIN_JWT_SECRET,
        hours: env.ADMIN_TOKEN_HOURS,
      })
    : null;
  const moderation = new ModerationService({
    users: models.User,
    parts: models.Part,
    reports: models.Report,
    audit: models.AuditEntry,
    partsService: parts,
    sessions,
    notifications,
    reviews,
    ownerSuspended: (userId, suspended) => shops.ownerSuspended(userId, suspended),
  });

  return {
    connection,
    env,
    models,
    mailer,
    users,
    sessions,
    tokens,
    otp,
    auth,
    photos,
    parts,
    saved,
    sellers,
    shops,
    reviews,
    reports,
    notifications,
    account,
    adminAuth,
    moderation,
    settings,
    announcements,
    requireAuth,
    optionalAuth: optionalAuthenticate(requireAuth),
  };
}

export type Container = ReturnType<typeof createContainer>;
