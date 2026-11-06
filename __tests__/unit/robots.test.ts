import robots from '../../app/robots';

describe('robots.txt', () => {
  const rules = [robots().rules].flat();

  it('keeps crawlers off the API', () => {
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ userAgent: '*', allow: '/' });
    expect(rules[0]!.disallow).toContain('/api/');
  });

  // A disallowed page is never fetched, so its noindex header is never read.
  it('leaves noindexed paths crawlable so their noindex is seen', () => {
    const disallowed = [rules[0]!.disallow].flat();
    for (const path of ['/admin', '/_next/', '/vendor/']) {
      expect(disallowed.some((prefix) => prefix && path.startsWith(prefix))).toBe(false);
    }
  });
});
