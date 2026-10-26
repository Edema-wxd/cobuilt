/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * The Neon Auth browser SDK is ESM-only and needs a browser. Unit suites that
 * import console helpers only reach it through app/admin/auth-client.ts and
 * never sign in, so jest.config and tsconfig.jest.json map the package here.
 */
export const BetterAuthVanillaAdapter = (): any => () => ({});
export const createAuthClient = (..._args: any[]): any => {
  throw new Error('Neon Auth is not available in unit tests');
};
