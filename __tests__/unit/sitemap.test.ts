import sitemap from '../../app/sitemap';
import { SERVICES } from '../../app/services/services';
import { publishedEntries } from '@/lib/repositories/sitemap';

jest.mock('@/lib/repositories/sitemap', () => ({ publishedEntries: jest.fn() }));

const ORIGIN = 'https://www.cobuiltpartners.com';

describe('sitemap without a database', () => {
  const saved = process.env.NEXT_PUBLIC_WEBSITE_URL;
  beforeAll(() => {
    process.env.NEXT_PUBLIC_WEBSITE_URL = ORIGIN;
  });
  afterAll(() => {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_WEBSITE_URL;
    else process.env.NEXT_PUBLIC_WEBSITE_URL = saved;
  });

  it('lists the fixed pages and the built-in service pages, with absolute URLs, rather than failing', async () => {
    jest.mocked(publishedEntries).mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5432'));

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toEqual(expect.arrayContaining([`${ORIGIN}/`, `${ORIGIN}/projects`, `${ORIGIN}/news`, `${ORIGIN}/contact`]));
    expect(urls).toEqual(expect.arrayContaining(SERVICES.map(({ slug }) => `${ORIGIN}/services/${slug}`)));
    expect(urls.every((url) => url.startsWith(`${ORIGIN}/`))).toBe(true);
    // Nothing is dated that the database would have dated.
    expect(entries.some((entry) => entry.lastModified)).toBe(false);
  });

  it('leaves out search results, the /downloads redirect and the console', async () => {
    jest.mocked(publishedEntries).mockRejectedValue(new Error('no database'));
    const paths = (await sitemap()).map((entry) => new URL(entry.url).pathname);

    expect(paths).not.toContain('/search');
    expect(paths).not.toContain('/downloads');
    expect(paths.some((path) => path.startsWith('/admin') || path.startsWith('/api'))).toBe(false);
  });
});
