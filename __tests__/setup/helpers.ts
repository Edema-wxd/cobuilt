import { createMocks, type RequestOptions } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';
import { signAccessToken } from '@/lib/auth/jwt';
import { effectivePermissions, type Role } from '@/lib/auth/rbac';

/**
 * Test helpers.
 *
 * Next.js API routes are plain (req, res) functions, so node-mocks-http drives
 * them directly. Supertest, which the spec sketches (§16), needs an Express app
 * to bind to and cannot invoke a Next route handler.
 */

export type ApiHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void;

export function bearerFor(input: {
  userId?: string;
  email?: string;
  role: Role;
}): string {
  const role = input.role;
  return signAccessToken({
    userId: input.userId ?? '00000000-0000-4000-8000-000000000001',
    email: input.email ?? `${role}@cobuilt.test`,
    role,
    permissions: [...effectivePermissions(role)],
  });
}

export async function callRoute(
  handler: ApiHandler,
  options: RequestOptions & { as?: Role } = {},
): Promise<{ status: number; body: any; headers: Record<string, unknown> }> {
  const { as, headers, ...rest } = options;

  const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
    method: 'GET',
    ...rest,
    headers: {
      ...(as ? { authorization: `Bearer ${bearerFor({ role: as })}` } : {}),
      ...headers,
    },
  });

  await handler(req, res);

  const raw = (res as any)._getData();
  let body: unknown = null;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
  }

  return {
    status: (res as any)._getStatusCode(),
    body,
    headers: (res as any).getHeaders(),
  };
}
