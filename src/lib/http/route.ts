import { randomUUID } from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { ZodError, type ZodType } from 'zod';
import { logger } from '../logger';
import { isProduction } from '../env';
import { bearerToken, verifyAccessToken } from '../auth/jwt';
import {
  effectivePermissions,
  type Permission,
  type Role,
} from '../auth/rbac';
import { consume, type RateLimitRule } from '../rateLimit';
import {
  ApiError,
  forbidden,
  methodNotAllowed,
  rateLimited,
  unauthorized,
  validationFailed,
} from './errors';
import { applyCors } from './cors';
import { assertCsrf } from './csrf';
import { getClientIp, getUserAgent } from './request';

/**
 * The single request pipeline every API route runs through.
 *
 * Declaring auth, validation, rate limiting and caching per method — rather
 * than composing middleware by hand in each file — means a route cannot
 * silently ship without them, and the whole policy for an endpoint is
 * readable in one place.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface AuthContext {
  userId: string;
  email: string;
  role: Role;
  permissions: Set<Permission>;
}

export interface RouteContext<TBody = unknown, TQuery = unknown> {
  req: NextApiRequest;
  res: NextApiResponse;
  body: TBody;
  query: TQuery;
  /** Present when auth is 'required'; may be null when 'optional' or absent. */
  auth: AuthContext | null;
  ip: string | null;
  userAgent: string | null;
  requestId: string;
}

export interface CachePolicy {
  /** Seconds a shared cache (CDN) may serve this response. */
  sMaxAge: number;
  /** Seconds a stale response may still be served while revalidating. */
  staleWhileRevalidate?: number;
}

export interface MethodConfig<TBody = unknown, TQuery = unknown> {
  handler: (ctx: RouteContext<TBody, TQuery>) => unknown;
  /** 'required' rejects anonymous callers; 'optional' populates ctx.auth when a valid token is present. */
  auth?: 'required' | 'optional';
  roles?: readonly Role[];
  permission?: Permission;
  rateLimit?: RateLimitRule;
  /** Defaults to the client IP; override to limit per user or per email. */
  rateLimitKey?: (req: NextApiRequest, ip: string | null) => string;
  /** Enforce double-submit CSRF. Defaults to true for cookie-authenticated writes. */
  csrf?: boolean;
  body?: ZodType<TBody>;
  query?: ZodType<TQuery>;
  cache?: CachePolicy;
}

/** Returned by a handler that needs a status other than 200. */
export class ApiResponse<T = unknown> {
  constructor(
    readonly status: number,
    readonly body: T,
    readonly headers: Record<string, string> = {},
  ) {}
}

export const created = <T>(body: T) => new ApiResponse(201, body);
export const accepted = <T>(body: T) => new ApiResponse(202, body);
export const noContent = () => new ApiResponse(204, null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMethodConfig = MethodConfig<any, any>;

export function createRoute(
  methods: Partial<Record<HttpMethod, AnyMethodConfig>>,
): (req: NextApiRequest, res: NextApiResponse) => Promise<void> {
  const allowed = Object.keys(methods) as HttpMethod[];

  return async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    const requestId = firstHeader(req, 'x-request-id') ?? randomUUID();
    res.setHeader('X-Request-Id', requestId);

    const startedAt = Date.now();

    try {
      if (applyCors(req, res)) return;

      const config = methods[(req.method ?? 'GET') as HttpMethod];
      if (!config) throw methodNotAllowed([...allowed, 'OPTIONS']);

      const ip = getClientIp(req);
      const userAgent = getUserAgent(req);

      await enforceRateLimit(config, req, res, ip);

      const auth = authenticate(config, req);
      authorise(config, auth);

      // Cookie-authenticated writes are CSRF-able; bearer-token ones are not.
      const usesCookieAuth = !bearerToken(req.headers.authorization);
      if (config.csrf ?? (usesCookieAuth && auth !== null)) {
        assertCsrf(req);
      }

      const body = parse(config.body, req.body, 'body');
      const query = parse(config.query, req.query, 'query');

      if (config.cache && req.method === 'GET') {
        applyCacheHeaders(res, config.cache);
      } else if (req.method !== 'GET') {
        res.setHeader('Cache-Control', 'no-store');
      }

      const result = await config.handler({
        req,
        res,
        body,
        query,
        auth,
        ip,
        userAgent,
        requestId,
      });

      send(res, result);

      logger.http('request', {
        requestId,
        method: req.method,
        path: req.url,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      respondWithError(res, error, requestId, req);
    }
  };
}

async function enforceRateLimit(
  config: AnyMethodConfig,
  req: NextApiRequest,
  res: NextApiResponse,
  ip: string | null,
): Promise<void> {
  if (!config.rateLimit) return;

  const key = config.rateLimitKey?.(req, ip) ?? ip ?? 'unknown';
  const result = await consume(config.rateLimit, key);

  res.setHeader('RateLimit-Limit', String(result.limit));
  res.setHeader('RateLimit-Remaining', String(result.remaining));
  res.setHeader('RateLimit-Reset', String(result.resetSeconds));

  if (!result.allowed) throw rateLimited(result.resetSeconds);
}

function authenticate(
  config: AnyMethodConfig,
  req: NextApiRequest,
): AuthContext | null {
  const needsAuth = config.auth === 'required' || Boolean(config.roles) || Boolean(config.permission);
  const token = bearerToken(req.headers.authorization);

  if (!token) {
    if (needsAuth) throw unauthorized();
    return null;
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (error) {
    // An invalid token on an optional-auth route is treated as anonymous
    // rather than an error, so a stale token cannot break public pages.
    if (needsAuth || config.auth === 'required') throw error;
    return null;
  }

  return {
    userId: payload.sub,
    email: payload.email,
    role: payload.role,
    // Recomputed from the role rather than trusted from the token: a role's
    // permission set can change between issuing a token and using it.
    permissions: effectivePermissions(payload.role, { grant: payload.permissions }),
  };
}

function authorise(config: AnyMethodConfig, auth: AuthContext | null): void {
  if (!config.roles && !config.permission) return;
  if (!auth) throw unauthorized();

  if (config.roles && !config.roles.includes(auth.role)) {
    throw forbidden(`Requires one of: ${config.roles.join(', ')}`);
  }

  if (config.permission && !auth.permissions.has(config.permission)) {
    throw forbidden(`Missing permission: ${config.permission}`);
  }
}

function parse<T>(schema: ZodType<T> | undefined, value: unknown, source: string): T {
  if (!schema) return value as T;

  const result = schema.safeParse(value ?? {});
  if (!result.success) {
    throw validationFailed(formatZodIssues(result.error), `Invalid request ${source}`);
  }
  return result.data;
}

export function formatZodIssues(error: ZodError): Array<{ field: string; message: string }> {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

function applyCacheHeaders(res: NextApiResponse, policy: CachePolicy): void {
  const swr = policy.staleWhileRevalidate ?? Math.floor(policy.sMaxAge / 2);
  res.setHeader(
    'Cache-Control',
    `public, max-age=0, s-maxage=${policy.sMaxAge}, stale-while-revalidate=${swr}`,
  );
}

function send(res: NextApiResponse, result: unknown): void {
  if (res.writableEnded) return; // Handler streamed or ended the response itself

  if (result instanceof ApiResponse) {
    for (const [name, value] of Object.entries(result.headers)) {
      res.setHeader(name, value);
    }
    if (result.status === 204 || result.body === null) {
      res.status(result.status).end();
      return;
    }
    res.status(result.status).json(result.body);
    return;
  }

  if (result === undefined) {
    res.status(204).end();
    return;
  }

  res.status(200).json(result);
}

function respondWithError(
  res: NextApiResponse,
  error: unknown,
  requestId: string,
  req: NextApiRequest,
): void {
  if (res.writableEnded) return;

  if (error instanceof ApiError) {
    for (const [name, value] of Object.entries(error.headers ?? {})) {
      res.setHeader(name, value);
    }
    // Client errors are expected traffic; only log them at debug level.
    logger.debug('Request rejected', {
      requestId,
      status: error.statusCode,
      code: error.code,
      message: error.message,
    });
    res.status(error.statusCode).json({
      error: { code: error.code, message: error.message, details: error.details, requestId },
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'validation_failed',
        message: 'Validation failed',
        details: formatZodIssues(error),
        requestId,
      },
    });
    return;
  }

  logger.error('Unhandled route error', {
    requestId,
    method: req.method,
    path: req.url,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  res.status(500).json({
    error: {
      code: 'internal_error',
      // Never surface an internal message in production: stack traces and
      // driver errors disclose schema and file layout.
      message: isProduction
        ? 'An unexpected error occurred'
        : error instanceof Error
          ? error.message
          : 'An unexpected error occurred',
      requestId,
    },
  });
}

function firstHeader(req: NextApiRequest, name: string): string | null {
  const value = req.headers[name];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
