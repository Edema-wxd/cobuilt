import { checkDestination, checkSource, isReservedPath, lookupKey } from '@/lib/redirectPaths';
import { createRedirectBody, updateRedirectBody } from '@/lib/schemas/redirects';

const ORIGINS = ['https://www.cobuiltpartners.com'];

describe('redirect paths', () => {
  it('stores a source the way a request is looked up: lower case, decoded, no trailing slash', () => {
    expect(checkSource('/About-Us/')).toEqual({ ok: true, value: '/about-us' });
    expect(checkSource('  /projects/Old-Name  ')).toEqual({ ok: true, value: '/projects/old-name' });
    expect(checkSource('/caf%C3%A9')).toEqual({ ok: true, value: '/café' });
    expect(lookupKey('/About-Us/?utm_source=x#top')).toBe('/about-us');
    expect(lookupKey('/caf%C3%A9')).toBe(lookupKey('/café'));
  });

  it.each([
    ['old-page', 'starting with a single /'],
    ['//evil.example/x', 'starting with a single /'],
    ['https://www.cobuiltpartners.com/old', 'starting with a single /'],
    ['/old?id=4', 'without a ? query'],
    ['/old#top', 'without a ? query'],
    ['/old page', 'spaces'],
    ['/old\\page', 'backslashes'],
    ['/', 'homepage'],
    ['///', 'starting with a single /'],
    ['/admin', '/admin, /api and /_next'],
    ['/Admin/users', '/admin, /api and /_next'],
    ['/api/health', '/admin, /api and /_next'],
    ['/_next/static/x.js', '/admin, /api and /_next'],
    [`/${'a'.repeat(600)}`, '512 characters'],
  ])('refuses the source %j', (source, message) => {
    const checked = checkSource(source);
    expect(checked.ok).toBe(false);
    expect(!checked.ok && checked.message).toContain(message);
  });

  it('does not mistake a path that merely starts like a reserved one', () => {
    expect(checkSource('/administration')).toEqual({ ok: true, value: '/administration' });
    expect(isReservedPath('/apiary')).toBe(false);
    expect(isReservedPath('/api')).toBe(true);
  });

  it('takes a path on this site, keeping its query string, or a web address elsewhere', () => {
    expect(checkDestination('/projects/new-name?tab=passport', ORIGINS)).toEqual({
      ok: true,
      value: { destination: '/projects/new-name?tab=passport', sitePath: '/projects/new-name' },
    });
    expect(checkDestination('https://partner.example.com/page', ORIGINS)).toEqual({
      ok: true,
      value: { destination: 'https://partner.example.com/page', sitePath: null },
    });
    // A link to this site's own origin is a path on it, for the loop check.
    expect(checkDestination('https://www.cobuiltpartners.com/About/', ORIGINS)).toEqual({
      ok: true,
      value: { destination: 'https://www.cobuiltpartners.com/About/', sitePath: '/about' },
    });
  });

  it.each([
    ['', 'Give a path'],
    ['javascript:alert(1)', 'https:// or http://'],
    ['data:text/html,hi', 'https:// or http://'],
    ['//evil.example/x', 'single /'],
    ['www.example.com', 'Give a path on this site'],
    ['/new page', 'spaces'],
  ])('refuses the destination %j', (destination, message) => {
    const checked = checkDestination(destination, ORIGINS);
    expect(checked.ok).toBe(false);
    expect(!checked.ok && checked.message).toContain(message);
  });

  it('refuses a rule that redirects to itself, and an empty update', () => {
    const self = createRedirectBody.safeParse({ sourcePath: '/Old/', destination: '/old' });
    expect(self.success).toBe(false);
    expect(self.error?.issues[0]).toMatchObject({ path: ['destination'], message: 'A path cannot redirect to itself' });
    expect(updateRedirectBody.safeParse({}).success).toBe(false);
  });

  it('defaults a new rule to permanent', () => {
    expect(createRedirectBody.parse({ sourcePath: '/old', destination: '/new' })).toEqual({
      sourcePath: '/old',
      destination: { destination: '/new', sitePath: '/new' },
      permanent: true,
    });
  });
});
