import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const secret = z.string().min(32, 'must be at least 32 characters');

const originList = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    MONGO_URI: z.string().min(1),

    JWT_ACCESS_SECRET: secret,
    JWT_RESET_SECRET: secret,
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(7),
    REFRESH_TOKEN_REMEMBER_DAYS: z.coerce.number().int().positive().default(30),

    OTP_EXPIRES_MINUTES: z.coerce.number().int().positive().default(5),
    OTP_RESEND_SECONDS: z.coerce.number().int().nonnegative().default(60),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

    CORS_ORIGINS: originList,

    /** Signs the dashboard's tokens; without it `/admin` is not served at all. */
    ADMIN_JWT_SECRET: z.preprocess((value) => value || undefined, secret.optional()),
    ADMIN_TOKEN_HOURS: z.coerce.number().int().positive().max(24).default(8),
    /** The dashboard's address(es), the only browsers allowed to call `/admin`. */
    ADMIN_ORIGINS: originList,
    TRUST_PROXY: z
      .string()
      .default('false')
      .transform((value) => (value === 'false' ? false : Number(value)))
      .refine((value) => value === false || (Number.isInteger(value) && value > 0), {
        message: 'must be false or a positive number of proxies',
      }),

    /** Where uploaded photos are kept, served under /uploads. */
    UPLOADS_DIR: z.string().default('uploads'),

    MAIL_HOST: z.string().default(''),
    MAIL_PORT: z.coerce.number().int().positive().default(587),
    MAIL_SECURE: booleanString,
    MAIL_USER: z.string().default(''),
    MAIL_PASS: z.string().default(''),
    MAIL_FROM: z.string().default('عربيتي <no-reply@3arabity.com>'),

    /** OAuth client ids whose Google tokens are accepted; empty turns Google sign-in off. */
    GOOGLE_CLIENT_IDS: originList,
  })
  .superRefine((env, ctx) => {
    if (env.JWT_ACCESS_SECRET === env.JWT_RESET_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_RESET_SECRET'],
        message: 'must differ from JWT_ACCESS_SECRET',
      });
    }
    const userSecrets = [env.JWT_ACCESS_SECRET, env.JWT_RESET_SECRET];
    if (env.ADMIN_JWT_SECRET && userSecrets.includes(env.ADMIN_JWT_SECRET)) {
      ctx.addIssue({
        code: 'custom',
        path: ['ADMIN_JWT_SECRET'],
        message: 'must differ from the user token secrets',
      });
    }
    // Production must really deliver codes; the console mailer is for development.
    if (env.NODE_ENV === 'production' && !env.MAIL_HOST) {
      ctx.addIssue({ code: 'custom', path: ['MAIL_HOST'], message: 'is required in production' });
    }
  });

export type Env = z.infer<typeof schema>;

/** Reads and checks the environment once, failing loudly on anything missing. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment:\n${problems}`);
  }
  return result.data;
}
