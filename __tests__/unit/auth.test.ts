import { bearerToken } from '@/lib/auth/jwt';
import { generateToken, hashToken, safeCompare } from '@/lib/auth/password';

describe('bearer tokens', () => {
  it('parses the Authorization header', () => {
    expect(bearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(bearerToken('bearer abc')).toBe('abc');
    expect(bearerToken('Basic abc')).toBeNull();
    expect(bearerToken('Bearer ')).toBeNull();
    expect(bearerToken(null)).toBeNull();
  });
});

describe('single-use tokens', () => {
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
