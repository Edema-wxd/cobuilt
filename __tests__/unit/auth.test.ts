import jwt from 'jsonwebtoken';
import { bearerToken, signAccessToken, verifyAccessToken } from '@/lib/auth/jwt';
import {
  generateToken,
  hashPassword,
  hashToken,
  safeCompare,
  verifyPassword,
} from '@/lib/auth/password';
import { ApiError } from '@/lib/http/errors';

describe('access tokens', () => {
  const claims = {
    userId: '11111111-1111-4111-8111-111111111111',
    email: 'editor@cobuilt.test',
    role: 'editor' as const,
    permissions: ['projects:write' as const],
  };

  it('round-trips its claims', () => {
    const payload = verifyAccessToken(signAccessToken(claims));
    expect(payload.sub).toBe(claims.userId);
    expect(payload.email).toBe(claims.email);
    expect(payload.role).toBe('editor');
  });

  it('rejects a token signed with a different secret', () => {
    const forged = jwt.sign({ role: 'admin' }, 'some-other-secret', {
      subject: claims.userId,
      issuer: 'cobuilt-api',
      audience: 'cobuilt-web',
    });
    expect(() => verifyAccessToken(forged)).toThrow(ApiError);
  });

  it('rejects an unsigned "alg: none" token', () => {
    const unsigned = jwt.sign({ role: 'admin', sub: claims.userId }, '', { algorithm: 'none' });
    expect(() => verifyAccessToken(unsigned)).toThrow(ApiError);
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign({ email: claims.email, role: 'admin' }, process.env.JWT_SECRET!, {
      subject: claims.userId,
      issuer: 'cobuilt-api',
      audience: 'cobuilt-web',
      expiresIn: -60,
    });
    expect(() => verifyAccessToken(expired)).toThrow(/expired/i);
  });

  it('rejects a token minted for another audience', () => {
    const wrongAudience = jwt.sign({ email: claims.email, role: 'admin' }, process.env.JWT_SECRET!, {
      subject: claims.userId,
      issuer: 'cobuilt-api',
      audience: 'some-other-app',
      expiresIn: 60,
    });
    expect(() => verifyAccessToken(wrongAudience)).toThrow(ApiError);
  });

  it('parses the Authorization header', () => {
    expect(bearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(bearerToken('bearer abc')).toBe('abc');
    expect(bearerToken('Basic abc')).toBeNull();
    expect(bearerToken('Bearer ')).toBeNull();
    expect(bearerToken(null)).toBeNull();
  });
});

describe('passwords and single-use tokens', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong password entirely', hash)).resolves.toBe(false);
  });

  it('never stores the password itself', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).not.toContain('correct horse');
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('stores only a hash of a single-use token', () => {
    const { token, hash } = generateToken();
    expect(token).toHaveLength(64);
    expect(hash).toBe(hashToken(token));
    expect(hash).not.toBe(token);
  });

  it('compares opaque tokens without leaking length mismatches', () => {
    expect(safeCompare('abc123', 'abc123')).toBe(true);
    expect(safeCompare('abc123', 'abc124')).toBe(false);
    expect(safeCompare('abc', 'abcdef')).toBe(false);
  });
});
