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
  // Identity is Neon Auth. The API verifies its EdDSA access tokens against the
  // branch JWKS; the admin console talks to the auth URL from the browser.
  NEON_AUTH_BASE_URL: z.string().url().optional(),
  NEON_AUTH_JWKS_URL: z.string().url().optional(),
  ALLOW_PUBLIC_REGISTRATION: bool(false),
  // Vercel sends it as a bearer token on cron invocations (/api/cron/*).
  CRON_SECRET: z.string().min(16).optional(),

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
  // UploadThing credential; UTApi and the file router read it from the environment.
  UPLOADTHING_TOKEN: z.string().optional(),
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

/**
 * A variable declared but left blank — a hosting dashboard with an empty value,
 * a `KEY=` line in a .env file — arrives as `''`, not as absent, so Zod skips
 * the default and the constraint underneath it fails. Dropping blanks here
 * means a declared-but-empty variable behaves like an unset one.
 */
function readEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string' && value.trim() !== '') out[key] = value;
  }
  return out;
}

/**
 * `next build` imports every route to collect its metadata, so this module is
 * evaluated at build time with NODE_ENV=production but without the runtime
 * secrets. Building is not booting: the production check belongs to the first
 * request, not to the bundler.
 */
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

function load(): Env {
  const raw = readEnv();
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${detail}`);
  }

  if (parsed.data.NODE_ENV === 'production' && !isBuildPhase) {
    const missing = requiredInProduction.filter((key) => !raw[key]);
    if (missing.length > 0) {
      throw new Error(
        `Missing required production environment variables: ${missing.join(', ')}`,
      );
    }
  }

  return parsed.data;
}

/**
 * Variables that must be set explicitly in production: the data stores would
 * otherwise fall back to development defaults, and without the Neon Auth
 * endpoints no request can be authenticated.
 */
const requiredInProduction = [
  'DATABASE_URL',
  'REDIS_URL',
  'NEON_AUTH_BASE_URL',
  'NEON_AUTH_JWKS_URL',
  'ALLOWED_ORIGINS',
] as const;

export const env: Env = load();

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
