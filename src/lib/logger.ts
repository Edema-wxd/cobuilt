import winston from 'winston';
import { env, isProduction } from './env';

const REDACTED = '[redacted]';

/**
 * Keys that must never reach a log sink. Redaction happens in a format rather
 * than at each call site, so a careless `logger.info('...', req.body)` cannot
 * leak a password into logs/combined.log.
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'jwt',
  'secret',
  'apiKey',
  'api_key',
]);

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEYS.has(key) ? REDACTED : redact(val, depth + 1);
  }
  return out;
}

// Redacts in place: winston routes each entry by symbol keys (level, message)
// that a copied object would lose, and every transport would then drop it.
const redactFormat = winston.format((info) => {
  for (const key of Object.keys(info)) {
    info[key] = SENSITIVE_KEYS.has(key) ? REDACTED : redact(info[key], 1);
  }
  return info;
});

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  defaultMeta: { service: 'cobuilt-api', env: env.NODE_ENV },
  format: winston.format.combine(
    redactFormat(),
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console({
      // Human-readable locally, JSON in production for the log shipper.
      format: isProduction
        ? winston.format.json()
        : winston.format.combine(winston.format.colorize(), winston.format.simple()),
      silent: env.NODE_ENV === 'test',
    }),
  ],
});

// On a serverless host the bundle directory is read-only and the process is
// discarded after the request, so a file sink would both fail to open and never
// be read. There, the Console transport above is the log shipper's input.
const hasWritableFilesystem = !process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME;

if (isProduction && hasWritableFilesystem) {
  logger.add(new winston.transports.File({ filename: 'logs/error.log', level: 'error' }));
  logger.add(new winston.transports.File({ filename: 'logs/combined.log' }));
}
