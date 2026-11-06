import JsonLd from '../../../components/JsonLd';
import { absoluteUrl } from '@/lib/seo';
import { ORGANIZATION_NAME, organizationId } from '@/lib/structuredData';
import type { PublicVacancy } from '../load-careers';

/**
 * schema.org `JobPosting` for a vacancy page, so search engines can list the
 * role in their job results. Rendered through the shared `JsonLd` component
 * (docs/decisions.md §2.27), with the hiring organisation pointing at the
 * site-wide `Organization` node. Only open vacancies carry it — a closed
 * advert's markup is meant to be removed — and `baseSalary` is given only when
 * the vacancy publishes a salary.
 */

const EMPLOYMENT_TYPE: Record<PublicVacancy['type'], string> = {
  full_time: 'FULL_TIME',
  part_time: 'PART_TIME',
  contract: 'CONTRACTOR',
  // A graduate programme place is a salaried, full-time position.
  graduate: 'FULL_TIME',
  internship: 'INTERN',
};

/** The posting as an object; exported for its test. */
export function jobPosting(vacancy: PublicVacancy): Record<string, unknown> {
  const description = [
    vacancy.summary,
    vacancy.description,
    vacancy.responsibilities.length ? `Responsibilities: ${vacancy.responsibilities.join('; ')}.` : null,
    vacancy.requirements.length ? `Requirements: ${vacancy.requirements.join('; ')}.` : null,
    vacancy.benefits.length ? `Benefits: ${vacancy.benefits.join('; ')}.` : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  const remote = vacancy.workPattern === 'remote';

  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: vacancy.title,
    description,
    identifier: { '@type': 'PropertyValue', name: ORGANIZATION_NAME, value: vacancy.id },
    datePosted: (vacancy.postedAt ?? new Date().toISOString()).slice(0, 10),
    // The end of the closing day in West Africa Time.
    ...(vacancy.closingDate ? { validThrough: `${vacancy.closingDate}T23:59:59+01:00` } : {}),
    employmentType: EMPLOYMENT_TYPE[vacancy.type],
    hiringOrganization: {
      '@type': 'Organization',
      '@id': organizationId(),
      name: ORGANIZATION_NAME,
      sameAs: absoluteUrl('/'),
      logo: absoluteUrl('/images/cobuilt-logo-light.webp'),
    },
    ...(remote
      ? {
          jobLocationType: 'TELECOMMUTE',
          applicantLocationRequirements: { '@type': 'Country', name: 'Nigeria' },
        }
      : {
          jobLocation: {
            '@type': 'Place',
            // The vacancy's location as the editor wrote it ("Lekki, Lagos"); no street is invented.
            address: { '@type': 'PostalAddress', addressLocality: vacancy.location, addressCountry: 'NG' },
          },
        }),
    ...(vacancy.salary
      ? {
          baseSalary: {
            '@type': 'MonetaryAmount',
            currency: vacancy.salary.currency,
            value: {
              '@type': 'QuantitativeValue',
              ...(vacancy.salary.min !== null && vacancy.salary.max !== null && vacancy.salary.min !== vacancy.salary.max
                ? { minValue: vacancy.salary.min, maxValue: vacancy.salary.max }
                : { value: vacancy.salary.min ?? vacancy.salary.max }),
              unitText: vacancy.salary.period === 'year' ? 'YEAR' : 'MONTH',
            },
          },
        }
      : {}),
    directApply: true,
    url: absoluteUrl(`/careers/${vacancy.slug}`),
  };
}

export default function JobPostingJsonLd({ vacancy }: { vacancy: PublicVacancy }) {
  return <JsonLd data={jobPosting(vacancy)} />;
}
