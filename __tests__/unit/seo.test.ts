import robots from '../../app/robots';
import {
  PRODUCTION_ORIGIN,
  absoluteUrl,
  canonical,
  canonicalPath,
  isIndexable,
  jsonLdText,
  siteOrigin,
} from '@/lib/seo';

/** Runs `fn` with the given variables set (or, for undefined, unset), then restores them. */
function withEnv(vars: Record<string, string | undefined>, fn: () => void): void {
  const saved = Object.fromEntries(Object.keys(vars).map((name) => [name, process.env[name]]));
  try {
    for (const [name, value] of Object.entries(vars)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    fn();
  } finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

const PRODUCTION = { NEXT_PUBLIC_WEBSITE_URL: PRODUCTION_ORIGIN, VERCEL_ENV: 'production' };

describe('site origin', () => {
  it('is the configured origin, without a path, and the production origin when unset or malformed', () => {
    expect(siteOrigin('https://staging.example.com/some/path').origin).toBe('https://staging.example.com');
    expect(siteOrigin(undefined).origin).toBe(PRODUCTION_ORIGIN);
    expect(siteOrigin('not a url').origin).toBe(PRODUCTION_ORIGIN);
  });

  it('builds absolute URLs and leaves absolute ones alone', () => {
    const origin = new URL('https://www.example.com');
    expect(absoluteUrl('/projects/ocean-ridge', origin)).toBe('https://www.example.com/projects/ocean-ridge');
    expect(absoluteUrl('https://utfs.io/f/abc.jpg', origin)).toBe('https://utfs.io/f/abc.jpg');
  });
});

describe('indexing', () => {
  it('allows only production, on the production origin', () => {
    expect(isIndexable(PRODUCTION)).toBe(true);
    // Off Vercel the origin alone decides.
    expect(isIndexable({ NEXT_PUBLIC_WEBSITE_URL: `${PRODUCTION_ORIGIN}/` })).toBe(true);
  });

  it('refuses a Vercel preview or development deployment, whatever its origin', () => {
    expect(isIndexable({ ...PRODUCTION, VERCEL_ENV: 'preview' })).toBe(false);
    expect(isIndexable({ ...PRODUCTION, VERCEL_ENV: 'development' })).toBe(false);
  });

  it('refuses any other origin, and an origin that was never set', () => {
    expect(isIndexable({ ...PRODUCTION, NEXT_PUBLIC_WEBSITE_URL: 'https://cobuilt-git-main.vercel.app' })).toBe(false);
    expect(isIndexable({ NEXT_PUBLIC_WEBSITE_URL: 'http://localhost:3000' })).toBe(false);
    expect(isIndexable({ NEXT_PUBLIC_WEBSITE_URL: 'https://cobuiltpartners.com' })).toBe(false);
    expect(isIndexable({ VERCEL_ENV: 'production' })).toBe(false);
    expect(isIndexable({})).toBe(false);
  });
});

describe('robots.txt', () => {
  it('lets crawlers in on production, except the console, the API and search results, and names the sitemap', () => {
    withEnv(PRODUCTION, () => {
      expect(robots()).toEqual({
        rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/search?'] },
        sitemap: `${PRODUCTION_ORIGIN}/sitemap.xml`,
      });
    });
  });

  it('turns every crawler away from a preview, and from a copy on another origin', () => {
    const closed = { rules: { userAgent: '*', disallow: '/' } };
    withEnv({ ...PRODUCTION, VERCEL_ENV: 'preview' }, () => expect(robots()).toEqual(closed));
    withEnv({ NEXT_PUBLIC_WEBSITE_URL: 'http://localhost:3501', VERCEL_ENV: undefined }, () =>
      expect(robots()).toEqual(closed),
    );
  });
});

describe('canonical URLs', () => {
  it('strips filters, fragments and trailing slashes', () => {
    expect(canonicalPath('/news?category=project_update')).toBe('/news');
    expect(canonicalPath('/videos?category=drone&project=ocean-ridge#player')).toBe('/videos');
    expect(canonicalPath('/gallery/')).toBe('/gallery');
    expect(canonicalPath('/')).toBe('/');
    expect(canonicalPath('?q=x')).toBe('/');
    expect(canonicalPath('projects')).toBe('/projects');
  });

  it('is absolute, on the site origin', () => {
    withEnv({ NEXT_PUBLIC_WEBSITE_URL: PRODUCTION_ORIGIN }, () => {
      expect(canonical('/news?category=press_release')).toEqual({ canonical: `${PRODUCTION_ORIGIN}/news` });
      expect(canonical('/')).toEqual({ canonical: `${PRODUCTION_ORIGIN}/` });
    });
  });
});

describe('JSON-LD text', () => {
  it('cannot close its script element, and parses back to the same data', () => {
    const data = {
      headline: 'Ground broken </script><script>alert(1)</script> & <!-- more -->',
      body: 'Line\u2028separator\u2029paragraph',
    };
    const text = jsonLdText(data);

    expect(text).not.toMatch(/[<>&\u2028\u2029]/);
    expect(text.toLowerCase()).not.toContain('</script');
    expect(JSON.parse(text)).toEqual(data);
  });
});
