/** Extracts a bearer token from the Authorization header, if present. */
export function bearerToken(authorization: string | null | undefined): string | null {
  if (!authorization) return null;
  const [scheme, ...rest] = authorization.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer') return null;
  const token = rest.join(' ').trim();
  return token.length > 0 ? token : null;
}
