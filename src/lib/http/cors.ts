import type { NextApiRequest, NextApiResponse } from 'next';
import { env } from '../env';
import { header } from './request';

/**
 * CORS for the API surface (§11). Origins come from ALLOWED_ORIGINS; the
 * wildcard is never used because credentialed requests (the refresh cookie)
 * require an exact origin echo.
 */

const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
const ALLOWED_HEADERS = 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With';

/**
 * Applies CORS headers. Returns true when the request was a preflight and has
 * been fully answered, in which case the caller must not run the handler.
 */
export function applyCors(req: NextApiRequest, res: NextApiResponse): boolean {
  const origin = header(req, 'origin');

  if (origin && env.ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    // Responses vary by origin, so a shared cache must not serve one
    // origin's response to another.
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
    res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
    return true;
  }

  return false;
}
