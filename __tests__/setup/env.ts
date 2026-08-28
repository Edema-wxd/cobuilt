/**
 * Test environment. Runs before any module is imported, so lib/env.ts sees a
 * complete configuration and no test accidentally reaches a real service.
 */
// @next/env types NODE_ENV as read-only; jest still needs it set here.
(process.env as Record<string, string>).NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
process.env.MAIL_PROVIDER = 'log';
process.env.LOG_LEVEL = 'error';
process.env.ALLOWED_ORIGINS = 'https://cobuilt.com,https://www.cobuilt.com';
process.env.REDIS_URL = 'redis://127.0.0.1:6379/15';
process.env.DATABASE_URL ??= 'postgresql://postgres@localhost:5432/cobuilt_test';
delete process.env.MEILISEARCH_URL;
delete process.env.AKISMET_API_KEY;
