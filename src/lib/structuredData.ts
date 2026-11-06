import type { ContactSettings } from './schemas/settings';
import { absoluteUrl, siteOrigin } from './seo';

/**
 * Schema.org structured data, as the JSON-LD `components/JsonLd.tsx` renders
 * (docs/decisions.md §2.27).
 *
 * Every builder takes only what its page already shows and leaves out what it
 * does not have: a field is omitted rather than guessed, because structured
 * data that disagrees with the page is worse than none. URLs are made
 * absolute against the site origin, as search engines require.
 *
 * No server imports, so a client page's breadcrumb trail can be described too.
 */

export type JsonLdObject = Record<string, unknown>;

const CONTEXT = 'https://schema.org';

export const ORGANIZATION_NAME = 'CoBuilt Investment Partners';

/** The header's logo, which is drawn for a light ground. */
const LOGO = '/images/cobuilt-logo-light.webp';

/** The organisation's node id, so other blocks can point at it rather than repeat it. */
export function organizationId(): string {
  return absoluteUrl('/#organization');
}

/** Drops null, undefined, blank strings and empty lists, so a block never claims an empty fact. */
function compact(object: JsonLdObject): JsonLdObject {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => {
      if (value === null || value === undefined) return false;
      if (typeof value === 'string') return value.trim() !== '';
      if (Array.isArray(value)) return value.length > 0;
      return true;
    }),
  );
}

const organizationRef = () => ({ '@id': organizationId() });

/**
 * The company, on the homepage: name, logo, address and every published phone
 * and email as a contact point, from `/admin/contact` (the constants in
 * components/site.ts when it was never saved, or there is no database).
 */
export function organization(contact: ContactSettings): JsonLdObject {
  return compact({
    '@context': CONTEXT,
    '@type': 'Organization',
    '@id': organizationId(),
    name: ORGANIZATION_NAME,
    url: absoluteUrl('/'),
    logo: absoluteUrl(LOGO),
    slogan: 'Building Trust Through Every Brick',
    address: contact.addressLines.join(', '),
    contactPoint: [
      ...contact.phones.map((phone) => ({
        '@type': 'ContactPoint',
        contactType: phone.label,
        telephone: phone.number,
      })),
      ...contact.emails.map((email) => ({
        '@type': 'ContactPoint',
        contactType: email.label,
        email: email.address,
      })),
    ],
  });
}

/** The site itself, with the search box `/search?q=` answers. */
export function website(): JsonLdObject {
  return {
    '@context': CONTEXT,
    '@type': 'WebSite',
    '@id': absoluteUrl('/#website'),
    name: ORGANIZATION_NAME,
    url: absoluteUrl('/'),
    publisher: organizationRef(),
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${siteOrigin().origin}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export interface BreadcrumbItem {
  label: string;
  /** Omitted on the trailing crumb, which is the current page. */
  href?: string;
}

/**
 * The breadcrumb a page shows, as a `BreadcrumbList`. Every crumb but the last
 * must link somewhere; a trail that does not (or has only one crumb) is not
 * described at all rather than described wrongly.
 */
export function breadcrumbList(trail: readonly BreadcrumbItem[]): JsonLdObject | null {
  if (trail.length < 2) return null;
  if (trail.slice(0, -1).some((crumb) => !crumb.href)) return null;

  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, index) =>
      compact({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.label,
        item: crumb.href ? absoluteUrl(crumb.href) : null,
      }),
    ),
  };
}

export interface NewsArticleInput {
  path: string;
  headline: string;
  description: string | null;
  image: string | null;
  datePublished: string | null;
  dateModified: string | null;
  /** The byline, as the page prints it. */
  author: string | null;
  section: string | null;
}

/**
 * An article. The byline is free text in the CMS, so it is described as the
 * person it names; without one, CoBuilt is the author as well as the publisher.
 */
export function newsArticle(input: NewsArticleInput): JsonLdObject {
  const url = absoluteUrl(input.path);
  return compact({
    '@context': CONTEXT,
    '@type': 'NewsArticle',
    mainEntityOfPage: url,
    url,
    headline: input.headline,
    description: input.description,
    image: input.image ? [absoluteUrl(input.image)] : null,
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    articleSection: input.section,
    author: input.author ? { '@type': 'Person', name: input.author } : organizationRef(),
    publisher: { '@type': 'Organization', '@id': organizationId(), name: ORGANIZATION_NAME, logo: absoluteUrl(LOGO) },
  });
}

/** `PT1H2M5S`, the ISO 8601 duration schema.org asks for. */
export function isoDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}${s || (!h && !m) ? `${s}S` : ''}`;
}

export interface VideoObjectInput {
  path: string;
  name: string;
  description: string;
  /** The still the page's player shows — never YouTube's own thumbnail. */
  thumbnailUrl: string;
  /** `YYYY-MM-DD`: the recording date, the only date the page gives. */
  uploadDate: string | null;
  durationSeconds: number | null;
  youtubeId: string;
}

/** A film, with the privacy-enhanced embed the player loads on request. */
export function videoObject(input: VideoObjectInput): JsonLdObject {
  return compact({
    '@context': CONTEXT,
    '@type': 'VideoObject',
    url: absoluteUrl(input.path),
    name: input.name,
    description: input.description,
    thumbnailUrl: [absoluteUrl(input.thumbnailUrl)],
    uploadDate: input.uploadDate,
    duration: input.durationSeconds ? isoDuration(input.durationSeconds) : null,
    embedUrl: `https://www.youtube-nocookie.com/embed/${input.youtubeId}`,
    publisher: organizationRef(),
  });
}

/** The published questions, as `/faqs` lists them. Null when there are none. */
export function faqPage(faqs: ReadonlyArray<{ question: string; answer: string }>): JsonLdObject | null {
  if (faqs.length === 0) return null;
  return {
    '@context': CONTEXT,
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}

export interface PersonInput {
  path: string;
  name: string;
  jobTitle: string | null;
  description: string | null;
  image: string | null;
  expertise: readonly string[];
  qualifications: readonly string[];
  /** The profile links the page lists under "Elsewhere". */
  sameAs: readonly string[];
}

/** A leader's profile. */
export function person(input: PersonInput): JsonLdObject {
  return compact({
    '@context': CONTEXT,
    '@type': 'Person',
    url: absoluteUrl(input.path),
    name: input.name,
    jobTitle: input.jobTitle,
    description: input.description,
    image: input.image ? absoluteUrl(input.image) : null,
    worksFor: organizationRef(),
    knowsAbout: [...input.expertise],
    hasCredential: input.qualifications.map((name) => ({
      '@type': 'EducationalOccupationalCredential',
      name,
    })),
    sameAs: [...input.sameAs],
  });
}

/** A service page: what it is and who provides it. */
export function service(input: { path: string; name: string; description: string }): JsonLdObject {
  return compact({
    '@context': CONTEXT,
    '@type': 'Service',
    url: absoluteUrl(input.path),
    name: input.name,
    serviceType: input.name,
    description: input.description,
    provider: organizationRef(),
  });
}

export interface GalleryInput {
  path: string;
  name: string;
  description: string | null;
  images: ReadonlyArray<{
    url: string;
    alt: string;
    caption: string | null;
    width: number | null;
    height: number | null;
    takenOn: string | null;
  }>;
}

/** An album: each photograph with the alt text and caption the page gives it. */
export function imageGallery(input: GalleryInput): JsonLdObject {
  return compact({
    '@context': CONTEXT,
    '@type': 'ImageGallery',
    url: absoluteUrl(input.path),
    name: input.name,
    description: input.description,
    publisher: organizationRef(),
    image: input.images.map((image) =>
      compact({
        '@type': 'ImageObject',
        contentUrl: absoluteUrl(image.url),
        description: image.alt,
        caption: image.caption,
        width: image.width,
        height: image.height,
        dateCreated: image.takenOn,
      }),
    ),
  });
}
