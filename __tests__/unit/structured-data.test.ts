import { PRODUCTION_ORIGIN } from '@/lib/seo';
import {
  breadcrumbList,
  faqPage,
  imageGallery,
  isoDuration,
  newsArticle,
  organization,
  person,
  videoObject,
  website,
} from '@/lib/structuredData';
import { DEFAULT_CONTACT_SETTINGS } from '@/lib/contactDetails';

const ORIGIN = 'https://www.example.com';

describe('structured data', () => {
  const saved = process.env.NEXT_PUBLIC_WEBSITE_URL;
  beforeAll(() => {
    process.env.NEXT_PUBLIC_WEBSITE_URL = ORIGIN;
  });
  afterAll(() => {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_WEBSITE_URL;
    else process.env.NEXT_PUBLIC_WEBSITE_URL = saved;
  });

  it('describes the organisation from the contact settings, with every phone and email', () => {
    const data = organization({
      ...DEFAULT_CONTACT_SETTINGS,
      phones: [
        { label: 'Office', number: '+234 700 262 8458' },
        { label: 'Sales', number: '+234 800 000 0000' },
      ],
      emails: [{ label: 'Press', address: 'press@cobuiltpartners.com' }],
    });

    expect(data).toMatchObject({
      '@type': 'Organization',
      '@id': `${ORIGIN}/#organization`,
      url: `${ORIGIN}/`,
      logo: `${ORIGIN}/images/cobuilt-logo-light.webp`,
      address: DEFAULT_CONTACT_SETTINGS.addressLines.join(', '),
    });
    expect(data.contactPoint).toEqual([
      { '@type': 'ContactPoint', contactType: 'Office', telephone: '+234 700 262 8458' },
      { '@type': 'ContactPoint', contactType: 'Sales', telephone: '+234 800 000 0000' },
      { '@type': 'ContactPoint', contactType: 'Press', email: 'press@cobuiltpartners.com' },
    ]);
  });

  it('points the site search at /search?q=', () => {
    expect(website()).toMatchObject({
      '@type': 'WebSite',
      potentialAction: {
        '@type': 'SearchAction',
        target: { urlTemplate: `${ORIGIN}/search?q={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    });
  });

  it('turns a breadcrumb trail into absolute list items, the current page last and unlinked', () => {
    expect(
      breadcrumbList([
        { label: 'Home', href: '/' },
        { label: 'Media', href: '/media' },
        { label: 'An article' },
      ]),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: 'Media', item: `${ORIGIN}/media` },
        { '@type': 'ListItem', position: 3, name: 'An article' },
      ],
    });
  });

  it('describes no trail rather than a wrong one', () => {
    expect(breadcrumbList([{ label: 'Home', href: '/' }])).toBeNull();
    expect(breadcrumbList([{ label: 'Home', href: '/' }, { label: 'Gap' }, { label: 'Page' }])).toBeNull();
  });

  it('leaves out what an article does not have, and credits CoBuilt without a byline', () => {
    const article = {
      path: '/news/ground-broken',
      headline: 'Ground broken',
      description: null,
      image: '/images/site.webp',
      datePublished: '2026-10-01T09:00:00.000Z',
      dateModified: null,
      author: null,
      section: 'Press release',
    };
    const data = newsArticle(article);

    expect(data).not.toHaveProperty('description');
    expect(data).not.toHaveProperty('dateModified');
    expect(data).toMatchObject({
      '@type': 'NewsArticle',
      url: `${ORIGIN}/news/ground-broken`,
      image: [`${ORIGIN}/images/site.webp`],
      author: { '@id': `${ORIGIN}/#organization` },
    });
    expect(newsArticle({ ...article, author: 'Ada Obi' }).author).toEqual({ '@type': 'Person', name: 'Ada Obi' });
  });

  it("embeds a film from youtube-nocookie.com, with the page's own still rather than YouTube's", () => {
    const data = videoObject({
      path: '/videos/ridge',
      name: 'Ridge',
      description: 'From the air.',
      thumbnailUrl: '/images/construction-site.webp',
      uploadDate: '2026-09-03',
      durationSeconds: 255,
      youtubeId: 'abcdefghijk',
    });

    expect(data).toMatchObject({
      embedUrl: 'https://www.youtube-nocookie.com/embed/abcdefghijk',
      thumbnailUrl: [`${ORIGIN}/images/construction-site.webp`],
      duration: 'PT4M15S',
      uploadDate: '2026-09-03',
    });
    expect(JSON.stringify(data)).not.toContain('ytimg');
  });

  it('writes ISO 8601 durations', () => {
    expect(isoDuration(42)).toBe('PT42S');
    expect(isoDuration(60)).toBe('PT1M');
    expect(isoDuration(3725)).toBe('PT1H2M5S');
    expect(isoDuration(0)).toBe('PT0S');
  });

  it('has no FAQ block without questions', () => {
    expect(faqPage([])).toBeNull();
    expect(faqPage([{ question: 'Q?', answer: 'A.' }])).toMatchObject({
      '@type': 'FAQPage',
      mainEntity: [{ '@type': 'Question', name: 'Q?', acceptedAnswer: { '@type': 'Answer', text: 'A.' } }],
    });
  });

  it('describes a leader with what the profile lists, and nothing it does not', () => {
    const data = person({
      path: '/leadership/ada-obi',
      name: 'Ada Obi',
      jobTitle: 'Managing Director',
      description: null,
      image: null,
      expertise: ['Delivery'],
      qualifications: ['MNSE'],
      sameAs: ['https://www.linkedin.com/in/ada'],
    });

    expect(data).not.toHaveProperty('image');
    expect(data).not.toHaveProperty('description');
    expect(data).toMatchObject({
      '@type': 'Person',
      worksFor: { '@id': `${ORIGIN}/#organization` },
      knowsAbout: ['Delivery'],
      hasCredential: [{ '@type': 'EducationalOccupationalCredential', name: 'MNSE' }],
      sameAs: ['https://www.linkedin.com/in/ada'],
    });
  });

  it('describes each photograph in an album with its alt text and caption', () => {
    const data = imageGallery({
      path: '/gallery/launch',
      name: 'Launch',
      description: null,
      images: [{ url: '/images/villa.webp', alt: 'A villa at dusk', caption: null, width: 800, height: 600, takenOn: null }],
    });
    expect(data.image).toEqual([
      { '@type': 'ImageObject', contentUrl: `${ORIGIN}/images/villa.webp`, description: 'A villa at dusk', width: 800, height: 600 },
    ]);
  });

  it('falls back to the production origin when none is configured', () => {
    delete process.env.NEXT_PUBLIC_WEBSITE_URL;
    try {
      expect(website().url).toBe(`${PRODUCTION_ORIGIN}/`);
    } finally {
      process.env.NEXT_PUBLIC_WEBSITE_URL = ORIGIN;
    }
  });
});
