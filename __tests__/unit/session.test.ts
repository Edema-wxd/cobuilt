import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type KeyLike } from 'jose';
import { ApiError } from '@/lib/http/errors';

const ORIGIN = 'https://auth.cobuilt.test';

let signingKey: KeyLike;
let otherKey: KeyLike;
let verifyNeonToken: typeof import('@/lib/auth/session').verifyNeonToken;

jest.mock('jose', () => ({ ...jest.requireActual('jose'), createRemoteJWKSet: jest.fn() }));

beforeAll(async () => {
  const jose = await import('jose');
  const pair = await generateKeyPair('EdDSA', { extractable: true });
  signingKey = pair.privateKey;
  otherKey = (await generateKeyPair('EdDSA')).privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'test-key', alg: 'EdDSA' };
  (jose.createRemoteJWKSet as jest.Mock).mockReturnValue(createLocalJWKSet({ keys: [jwk] }));
  ({ verifyNeonToken } = jest.requireActual('@/lib/auth/session'));
});

function sign(
  claims: Record<string, unknown>,
  options: { key?: KeyLike; issuer?: string; audience?: string; expiresIn?: string } = {},
) {
  return new SignJWT({ emailVerified: true, ...claims })
    .setProtectedHeader({ alg: 'EdDSA', kid: 'test-key' })
    .setSubject('a003c703-1c39-43d3-9be5-e6240b341a3e')
    .setIssuedAt()
    .setIssuer(options.issuer ?? ORIGIN)
    .setAudience(options.audience ?? ORIGIN)
    .setExpirationTime(options.expiresIn ?? '15m')
    .sign(options.key ?? signingKey);
}

describe('verifyNeonToken', () => {
  it('returns the identity a valid token asserts', async () => {
    const identity = await verifyNeonToken(
      await sign({ email: 'editor@cobuilt.test', name: 'Test Editor' }),
    );
    expect(identity).toEqual({
      id: 'a003c703-1c39-43d3-9be5-e6240b341a3e',
      email: 'editor@cobuilt.test',
      emailVerified: true,
      name: 'Test Editor',
    });
  });

  it('treats a missing emailVerified claim as unverified', async () => {
    const token = await sign({ email: 'editor@cobuilt.test', emailVerified: undefined });
    expect((await verifyNeonToken(token)).emailVerified).toBe(false);
  });

  it('rejects a token signed with another key', async () => {
    const token = await sign({ email: 'a@cobuilt.test' }, { key: otherKey });
    await expect(verifyNeonToken(token)).rejects.toBeInstanceOf(ApiError);
  });

  it('rejects an expired token', async () => {
    const token = await sign({ email: 'a@cobuilt.test' }, { expiresIn: '-1m' });
    await expect(verifyNeonToken(token)).rejects.toThrow(/expired/i);
  });

  it('rejects a token from another issuer or audience', async () => {
    await expect(
      verifyNeonToken(await sign({ email: 'a@cobuilt.test' }, { issuer: 'https://evil.test' })),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(
      verifyNeonToken(await sign({ email: 'a@cobuilt.test' }, { audience: 'https://other.test' })),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('rejects an unsigned "alg: none" token', async () => {
    const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
    const unsigned = `${b64({ alg: 'none' })}.${b64({ sub: 'x', email: 'a@cobuilt.test', iss: ORIGIN, aud: ORIGIN })}.`;
    await expect(verifyNeonToken(unsigned)).rejects.toBeInstanceOf(ApiError);
  });

  it('rejects a token without an email', async () => {
    await expect(verifyNeonToken(await sign({}))).rejects.toBeInstanceOf(ApiError);
  });
});
