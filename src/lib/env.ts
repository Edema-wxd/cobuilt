import { z } from 'zod';

/**
 * Single source of truth for configuration.
 *
 * Every environment variable the backend reads is declared here and validated
 * once at boot, so a missing secret fails immediately with a readable message
 * instead of surfacing as a null-pointer three layers into a request.
 */

/** Env vars are strings; these coerce the two shapes we actually use. */
const bool = (fallback: boolean) =>
  z
    .enum(['true', 'false', '1', '0'])
    .transform((v) => v === 'true' || v === '1')
    .default(fallback);

const csv = (fallback: string[]) =>
  z
    .string()
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean))
    .default(fallback);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),

  // --- Data stores -------------------------------------------------------
  DATABASE_URL: z.string().default('postgresql://postgres@localhost:5432/cobuilt'),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  DATABASE_SSL: bool(false),
  REDIS_URL: z.string().default('redis://localhost:6379/0'),

  // --- Search ------------------------------------------------------------
  // Absent MEILISEARCH_URL, search degrades to PostgreSQL full-text (§6).
  MEILISEARCH_URL: z.string().optional(),
  MEILISEARCH_KEY: z.string().optional(),

  // --- Auth --------------------------------------------------------------
  JWT_SECRET: z.string().min(32).default('dev-only-insecure-secret-change-me-0123456789'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(15 * 60),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(7 * 24 * 60 * 60),
  JWT_ISSUER: z.string().default('cobuilt-api'),
  JWT_AUDIENCE: z.string().default('cobuilt-web'),
  ALLOW_PUBLIC_REGISTRATION: bool(false),

  // --- Web ---------------------------------------------------------------
  ALLOWED_ORIGINS: csv(['https://cobuilt.com', 'https://www.cobuilt.com']),
  NEXT_PUBLIC_WEBSITE_URL: z.string().default('https://cobuilt.com'),
  NEXT_PUBLIC_API_URL: z.string().default('https://api.cobuilt.com'),

  // --- Mail --------------------------------------------------------------
  // Provider is an open decision (§17); `log` writes to the logger instead of
  // sending, which is the default for development and CI.
  MAIL_PROVIDER: z.enum(['log', 'sendgrid', 'ses', 'mailgun']).default('log'),
  MAIL_FROM: z.string().default('no-reply@cobuilt.com'),
  MAIL_FROM_NAME: z.string().default('CoBuilt Investment Partners'),
  ADMIN_EMAIL: z.string().default('admin@cobuilt.com'),
  LEGAL_EMAIL: z.string().default('legal@cobuilt.com'),
  SENDGRID_API_KEY: z.string().optional(),
  MAILGUN_API_KEY: z.string().optional(),
  MAILGUN_DOMAIN: z.string().optional(),

  // --- Storage -----------------------------------------------------------
  S3_BUCKET: z.string().default('cobuilt-tours'),
  S3_REGION: z.string().default('us-east-1'),
  // Set for any S3-compatible service (DigitalOcean Spaces, a Nigerian
  // Tier III object store). Left unset, the AWS default endpoint is used.
  S3_ENDPOINT: z.string().optional(),
  S3_FORCE_PATH_STYLE: bool(false),
  S3_PUBLIC_BASE_URL: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  MAX_TOUR_UPLOAD_BYTES: z.coerce.number().int().positive().default(50 * 1024 * 1024),

  // --- CMS ---------------------------------------------------------------
  CMS_SOURCE: z.string().default('strapi'),
  STRAPI_API_URL: z.string().optional(),
  STRAPI_API_TOKEN: z.string().optional(),
  CMS_WEBHOOK_SECRET: z.string().optional(),
  REVALIDATE_SECRET: z.string().optional(),

  // --- Integrations ------------------------------------------------------
  WHATSAPP_WEBHOOK_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  CHAT_WEBHOOK_SECRET: z.string().optional(),
  AKISMET_API_KEY: z.string().optional(),

  // --- Observability -----------------------------------------------------
  SENTRY_DSN: z.string().optional(),

  // --- Retention (days), NDPA §11 ---------------------------------------
  RETENTION_FORM_SUBMISSION_DAYS: z.coerce.number().int().positive().default(90),
  RETENTION_INVESTOR_INQUIRY_DAYS: z.coerce.number().int().positive().default(730),
  RETENTION_PAGE_VIEW_DAYS: z.coerce.number().int().positive().default(30),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${detail}`);
  }

  if (parsed.data.NODE_ENV === 'production') {
    const missing = requiredInProduction.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(
        `Missing required production environment variables: ${missing.join(', ')}`,
      );
    }
  }

  return parsed.data;
}

/**
 * Variables with development defaults that must never reach production on
 * those defaults — a fallback JWT secret in production is a total auth bypass.
 */
const requiredInProduction = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'ALLOWED_ORIGINS',
] as const;

export const env: Env = load();

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
