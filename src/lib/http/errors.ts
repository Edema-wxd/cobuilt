/**
 * The error taxonomy every route uses. Anything thrown that is not an ApiError
 * is treated as an unexpected failure and reported as a 500 with no internal
 * detail leaked to the client (see createRoute in ./route.ts).
 */

export type ErrorCode =
  | 'bad_request'
  | 'validation_failed'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'payload_too_large'
  | 'unsupported_media_type'
  | 'method_not_allowed'
  | 'rate_limited'
  | 'service_unavailable'
  | 'internal_error';

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;
  /** Extra response headers, e.g. Retry-After on a 429. */
  readonly headers?: Record<string, string>;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    options: { details?: unknown; headers?: Record<string, string> } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = options.details;
    this.headers = options.headers;
  }
}

export const badRequest = (message = 'Bad request', details?: unknown) =>
  new ApiError(400, 'bad_request', message, { details });

export const validationFailed = (details: unknown, message = 'Validation failed') =>
  new ApiError(422, 'validation_failed', message, { details });

export const unauthorized = (message = 'Authentication required') =>
  new ApiError(401, 'unauthorized', message);

export const forbidden = (message = 'Forbidden') => new ApiError(403, 'forbidden', message);

export const notFound = (message = 'Not found') => new ApiError(404, 'not_found', message);

export const conflict = (message = 'Conflict', details?: unknown) =>
  new ApiError(409, 'conflict', message, { details });

export const payloadTooLarge = (message = 'Payload too large') =>
  new ApiError(413, 'payload_too_large', message);

export const methodNotAllowed = (allowed: readonly string[]) =>
  new ApiError(405, 'method_not_allowed', 'Method not allowed', {
    headers: { Allow: allowed.join(', ') },
  });

export const rateLimited = (retryAfterSeconds: number) =>
  new ApiError(429, 'rate_limited', 'Too many requests', {
    headers: { 'Retry-After': String(Math.max(1, Math.ceil(retryAfterSeconds))) },
  });

export const serviceUnavailable = (message = 'Service unavailable') =>
  new ApiError(503, 'service_unavailable', message);
