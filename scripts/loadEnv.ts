import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvConfig } from '@next/env';

/**
 * Loads .env files the way `next start` does. Scripts run under tsx, pm2 and
 * cron, none of which read them, so without this the worker and migrations
 * would fall back to development defaults on a server. Variables already set
 * in the environment win. Import this before anything that reads lib/env.
 */
loadEnvConfig(
  join(dirname(fileURLToPath(import.meta.url)), '..'),
  process.env.NODE_ENV === 'development',
);
