import { effectivePermissions, type Role } from '@/lib/auth/rbac';

/**
 * Route tests do not talk to Neon Auth. Registered through jest.config's
 * setupFilesAfterEnv, this replaces token verification and account lookup with
 * a bearer value that carries the account directly, so a suite can call a
 * route "as" a role without seeding users or signing JWTs. The real
 * verification path is covered in __tests__/unit/session.test.ts and
 * __tests__/integration/auth-flow.test.ts.
 */

interface TestAccount {
  userId: string;
  email: string;
  role: Role;
}

export function testToken(account: TestAccount): string {
  return `test.${Buffer.from(JSON.stringify(account)).toString('base64url')}`;
}

jest.mock('@/lib/auth/session', () => {
  const actual = jest.requireActual('@/lib/auth/session');
  const { unauthorized } = jest.requireActual('@/lib/http/errors');
  return {
    ...actual,
    authenticateBearer: (token: string) => {
      if (!token.startsWith('test.')) throw unauthorized('Invalid token');
      const account = JSON.parse(
        Buffer.from(token.slice('test.'.length), 'base64url').toString(),
      ) as TestAccount;
      return Promise.resolve({ ...account, permissions: effectivePermissions(account.role) });
    },
  };
});
