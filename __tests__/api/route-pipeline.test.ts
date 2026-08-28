import { z } from 'zod';
import { ApiResponse, createRoute, created, noContent } from '@/lib/http/route';
import { badRequest, notFound } from '@/lib/http/errors';
import { callRoute, bearerFor } from '../setup/helpers';

/**
 * The request pipeline is the one piece of code every endpoint runs through,
 * so its auth, validation and error behaviour is tested directly rather than
 * inferred from the routes that use it.
 */

describe('createRoute', () => {
  describe('method routing', () => {
    const route = createRoute({ GET: { handler: () => ({ ok: true }) } });

    it('dispatches a declared method', async () => {
      const res = await callRoute(route, { method: 'GET' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });

    it('rejects an undeclared method with 405 and an Allow header', async () => {
      const res = await callRoute(route, { method: 'DELETE' });
      expect(res.status).toBe(405);
      expect(res.body.error.code).toBe('method_not_allowed');
      expect(res.headers.allow).toContain('GET');
    });

    it('answers a CORS preflight without running the handler', async () => {
      const handler = jest.fn();
      const withHandler = createRoute({ GET: { handler } });

      const res = await callRoute(withHandler, {
        method: 'OPTIONS',
        headers: { origin: 'https://cobuilt.com' },
      });

      expect(res.status).toBe(204);
      expect(handler).not.toHaveBeenCalled();
      expect(res.headers['access-control-allow-origin']).toBe('https://cobuilt.com');
    });

    it('does not echo an origin that is not allowed', async () => {
      const res = await callRoute(route, {
        method: 'GET',
        headers: { origin: 'https://attacker.example' },
      });
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('validation', () => {
    const route = createRoute({
      POST: {
        body: z.object({ email: z.string().email(), age: z.number().int().min(0) }),
        csrf: false,
        handler: ({ body }) => body,
      },
    });

    it('passes a valid body through to the handler', async () => {
      const res = await callRoute(route, {
        method: 'POST',
        body: { email: 'a@b.com', age: 30 },
      });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ email: 'a@b.com', age: 30 });
    });

    it('returns 422 naming each invalid field', async () => {
      const res = await callRoute(route, {
        method: 'POST',
        body: { email: 'not-an-email', age: -1 },
      });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('validation_failed');
      expect(res.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual([
        'age',
        'email',
      ]);
    });

    it('coerces and defaults query parameters', async () => {
      const withQuery = createRoute({
        GET: {
          query: z.object({
            page: z.coerce.number().int().default(1),
            pageSize: z.coerce.number().int().default(12),
          }),
          handler: ({ query }) => query,
        },
      });

      const res = await callRoute(withQuery, { method: 'GET', query: { page: '3' } });
      expect(res.body).toEqual({ page: 3, pageSize: 12 });
    });
  });

  describe('authentication and authorisation', () => {
    const adminOnly = createRoute({
      GET: { roles: ['admin'], handler: ({ auth }) => ({ role: auth!.role }) },
    });

    it('rejects an anonymous caller with 401', async () => {
      const res = await callRoute(adminOnly, { method: 'GET' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('unauthorized');
    });

    it('rejects a wrong-role caller with 403', async () => {
      const res = await callRoute(adminOnly, { method: 'GET', as: 'editor' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('forbidden');
    });

    it('admits the right role', async () => {
      const res = await callRoute(adminOnly, { method: 'GET', as: 'admin' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ role: 'admin' });
    });

    it('enforces a permission independently of role', async () => {
      const route = createRoute({
        DELETE: { permission: 'projects:delete', handler: () => noContent() },
      });

      // An editor holds projects:write but must not hold projects:delete.
      expect((await callRoute(route, { method: 'DELETE', as: 'editor' })).status).toBe(403);
      expect((await callRoute(route, { method: 'DELETE', as: 'admin' })).status).toBe(204);
    });

    it('treats an invalid token as anonymous on an optional-auth route', async () => {
      const route = createRoute({
        GET: { auth: 'optional', handler: ({ auth }) => ({ authenticated: auth !== null }) },
      });

      const res = await callRoute(route, {
        method: 'GET',
        headers: { authorization: 'Bearer not.a.real.token' },
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ authenticated: false });
    });

    it('rejects an invalid token on a required-auth route', async () => {
      const route = createRoute({ GET: { auth: 'required', handler: () => ({ ok: true }) } });

      const res = await callRoute(route, {
        method: 'GET',
        headers: { authorization: 'Bearer not.a.real.token' },
      });

      expect(res.status).toBe(401);
    });

    it('recomputes permissions from the role rather than trusting the token', async () => {
      // A token whose permission claims were tampered with must not grant
      // anything the role does not carry.
      const forged = bearerFor({ role: 'viewer' });
      const route = createRoute({
        POST: { permission: 'projects:write', csrf: false, handler: () => ({ ok: true }) },
      });

      const res = await callRoute(route, {
        method: 'POST',
        headers: { authorization: `Bearer ${forged}` },
      });

      expect(res.status).toBe(403);
    });
  });

  describe('responses', () => {
    it('returns 201 from created()', async () => {
      const route = createRoute({ POST: { csrf: false, handler: () => created({ id: 'x' }) } });
      const res = await callRoute(route, { method: 'POST' });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ id: 'x' });
    });

    it('returns 204 with no body from noContent()', async () => {
      const route = createRoute({ DELETE: { csrf: false, handler: () => noContent() } });
      const res = await callRoute(route, { method: 'DELETE' });
      expect(res.status).toBe(204);
      expect(res.body).toBeNull();
    });

    it('sets a CDN cache policy on cacheable GETs only', async () => {
      const route = createRoute({
        GET: { cache: { sMaxAge: 3600, staleWhileRevalidate: 600 }, handler: () => ({}) },
        POST: { csrf: false, handler: () => ({}) },
      });

      const read = await callRoute(route, { method: 'GET' });
      expect(read.headers['cache-control']).toBe(
        'public, max-age=0, s-maxage=3600, stale-while-revalidate=600',
      );

      const write = await callRoute(route, { method: 'POST' });
      expect(write.headers['cache-control']).toBe('no-store');
    });

    it('honours a custom status and headers from ApiResponse', async () => {
      const route = createRoute({
        GET: { handler: () => new ApiResponse(207, { partial: true }, { 'X-Custom': 'yes' }) },
      });

      const res = await callRoute(route, { method: 'GET' });
      expect(res.status).toBe(207);
      expect(res.headers['x-custom']).toBe('yes');
    });
  });

  describe('error handling', () => {
    it('maps an ApiError to its status and code', async () => {
      const route = createRoute({ GET: { handler: () => { throw notFound('Project not found'); } } });
      const res = await callRoute(route, { method: 'GET' });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatchObject({ code: 'not_found', message: 'Project not found' });
    });

    it('carries details through on a bad request', async () => {
      const route = createRoute({
        GET: { handler: () => { throw badRequest('Nope', { field: 'x' }); } },
      });
      const res = await callRoute(route, { method: 'GET' });

      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual({ field: 'x' });
    });

    it('turns an unexpected throw into a 500 without leaking a stack trace', async () => {
      const route = createRoute({
        GET: { handler: () => { throw new Error('connection string: postgres://user:pw@host'); } },
      });

      const res = await callRoute(route, { method: 'GET' });

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('internal_error');
      expect(JSON.stringify(res.body)).not.toContain('at Object');
    });

    it('attaches a request id to every response', async () => {
      const route = createRoute({ GET: { handler: () => ({ ok: true }) } });
      const res = await callRoute(route, { method: 'GET' });
      expect(res.headers['x-request-id']).toEqual(expect.any(String));
    });

    it('echoes an upstream request id so a trace survives the proxy hop', async () => {
      const route = createRoute({ GET: { handler: () => ({ ok: true }) } });
      const res = await callRoute(route, {
        method: 'GET',
        headers: { 'x-request-id': 'trace-abc-123' },
      });
      expect(res.headers['x-request-id']).toBe('trace-abc-123');
    });
  });
});
