import type { Metadata } from 'next';
import PageHero from '../../../components/PageHero';
import SiteLayout from '../../../components/SiteLayout';
import { bodyCopy, titleSm } from '../../../components/sections';
import { btnOrange, btnOutline, btnOutlineOnDark, container, eyebrowOnLine } from '../../../components/ui';
import { canonical } from '@/lib/seo';
import { turnstileSiteKey } from '@/lib/turnstile';
import { VACANCY_TYPE_LABELS, WORK_PATTERN_LABELS, formatClosingDate, salaryText } from '@/lib/careers';
import ApplicationForm from '../application-form';
import { closingText } from '../careers-shared';
import { loadVacancy, vacancySlugs, type PublicVacancy } from '../load-careers';
import { redirectOrNotFound } from '../../redirect-or-not-found';
import JobPostingJsonLd from './job-posting';

/**
 * A vacancy — `/careers/[slug]`.
 *
 * The role in full — summary, description, responsibilities, requirements,
 * benefits, the salary where one is published, location and closing date —
 * then its application form, which posts to `/api/careers/apply` with the
 * vacancy's id (docs/decisions.md §2.28). Open vacancies carry `JobPosting`
 * JSON-LD.
 *
 * Once its closing date has passed the page stays up, says the vacancy has
 * closed, drops the form and the JSON-LD and asks search engines not to index
 * it, so a link shared while it was open does not end in a 404. A draft is a
 * 404. With no database the page says it couldn't be loaded rather than
 * answering 404 for a role that may well exist. Prerendered, and regenerated
 * at most once a minute, like /careers; a vacancy published after the build
 * renders on its first request.
 */

export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return vacancySlugs();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadVacancy(slug);
  if (result.kind !== 'found') return { title: 'Careers' };

  const { vacancy } = result;
  const description = `${vacancy.summary} ${VACANCY_TYPE_LABELS[vacancy.type]}, ${vacancy.location}. ${closingText(vacancy)}.`;
  return {
    title: `${vacancy.title} — Careers`,
    description,
    alternates: canonical(`/careers/${vacancy.slug}`),
    openGraph: { type: 'website', title: `${vacancy.title} — CoBuilt Investment Partners`, description },
    twitter: { card: 'summary_large_image' },
    // A closed advert should drop out of search results, not linger in them.
    ...(vacancy.isOpen ? {} : { robots: { index: false, follow: true } }),
  };
}

const TRAIL_HEAD = [
  { label: 'Home', href: '/' },
  { label: 'Careers', href: '/careers' },
];

export default async function VacancyPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await loadVacancy(slug);
  // An unknown address may be an old one with a rule at /admin/redirects.
  if (result.kind === 'not-found') return redirectOrNotFound(`/careers/${slug}`);

  if (result.kind === 'unavailable') {
    return (
      <SiteLayout current="/careers">
        <main>
          <PageHero eyebrow="Careers" title="Vacancy" trail={[...TRAIL_HEAD, { label: 'Vacancy' }]} />
          <section className="bg-white py-11 sm:py-14 md:py-18">
            <div className={container}>
              <div className="border border-line bg-zinc-50 px-6 py-10 sm:px-10" role="status">
                <p className="text-[1.0625rem] text-ink">This vacancy couldn’t be loaded.</p>
                <p className="mt-2 text-[0.906rem] leading-[1.7] text-zinc-700">
                  This is on our side. Try again in a minute, or see{' '}
                  <a className="text-rust underline hover:text-rust-hover" href="/careers">
                    all careers at CoBuilt
                  </a>
                  .
                </p>
              </div>
            </div>
          </section>
        </main>
      </SiteLayout>
    );
  }

  const { vacancy } = result;
  const salary = salaryText(vacancy.salary);

  return (
    <SiteLayout current="/careers">
      <main>
        {vacancy.isOpen ? <JobPostingJsonLd vacancy={vacancy} /> : null}
        <PageHero
          eyebrow={VACANCY_TYPE_LABELS[vacancy.type]}
          title={vacancy.title}
          standfirst={vacancy.summary}
          trail={[...TRAIL_HEAD, { label: vacancy.title }]}
          actions={
            vacancy.isOpen ? (
              <>
                <a className={btnOrange} href="#apply">
                  Apply for this role
                </a>
                <a className={btnOutlineOnDark} href="/careers">
                  All vacancies
                </a>
              </>
            ) : undefined
          }
          meta={
            <>
              {vacancy.location}
              {vacancy.workPattern ? ` · ${WORK_PATTERN_LABELS[vacancy.workPattern]}` : ''}
              {' · '}
              {vacancy.isOpen ? closingText(vacancy) : `Closed ${formatClosingDate(vacancy.closingDate!)}`}
            </>
          }
        />

        {vacancy.isOpen ? null : (
          <section className="border-b border-line bg-white pt-11 sm:pt-14" aria-labelledby="closed-title">
            <div className={container}>
              <div className="flex max-w-190 flex-col gap-3 border-l-3 border-orange bg-zinc-100 px-5.5 py-5">
                <h2 id="closed-title" className="text-[0.719rem] font-bold tracking-[0.16em] text-ink uppercase">
                  This vacancy has closed
                </h2>
                <p className="text-[0.906rem] leading-[1.75] text-zinc-700">
                  Applications closed on {formatClosingDate(vacancy.closingDate!)}, and no more can be sent
                  for this role. The advert stays here for reference.
                </p>
                <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:flex-wrap sm:gap-3">
                  <a className={btnOutline} href="/careers#vacancies">
                    See current vacancies
                  </a>
                  <a className={btnOutline} href="/careers#apply">
                    Send a speculative application
                  </a>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="bg-white py-11 sm:py-14 md:py-18" aria-label="About the role">
          <div className={`${container} grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16`}>
            <div className="flex max-w-190 flex-col gap-9">
              {vacancy.description ? (
                <RoleSection title="About the role">
                  {vacancy.description.split(/\n{2,}/).map((paragraph) => (
                    <p key={paragraph.slice(0, 40)} className={`${bodyCopy} whitespace-pre-line`}>
                      {paragraph}
                    </p>
                  ))}
                </RoleSection>
              ) : null}
              <RoleList title="What you will do" items={vacancy.responsibilities} />
              <RoleList title="What we are looking for" items={vacancy.requirements} />
              <RoleList title="What comes with it" items={vacancy.benefits} />
            </div>

            <aside className="reveal flex flex-col self-start border border-zinc-300" aria-label="The role at a glance">
              <Facts vacancy={vacancy} salary={salary} />
            </aside>
          </div>
        </section>

        {vacancy.isOpen ? (
          <section className="scroll-mt-24 bg-line py-13 sm:py-16 md:py-20" id="apply" aria-labelledby="apply-title">
            <div className={`${container} grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-13`}>
              <div className="reveal flex flex-col gap-5">
                <p className={eyebrowOnLine}>Apply online</p>
                <h2 className={titleSm} id="apply-title">
                  Apply for this role
                </h2>
                <p className="text-[0.969rem] leading-[1.75] text-zinc-700">
                  Your CV and a short note are all we ask for. Applications are taken until the end of{' '}
                  {vacancy.closingDate ? formatClosingDate(vacancy.closingDate) : 'the day the role is filled'}{' '}
                  (West Africa Time), and we reply to every one.
                </p>
                <p className="text-[0.906rem] leading-[1.7] text-zinc-700">
                  CoBuilt recruits on merit, and will make reasonable adjustments at any stage of the
                  process — tell us what you need in your note.
                </p>
                <p className="text-[0.906rem] leading-[1.7] text-zinc-700 [&_a]:text-rust-hover [&_a]:underline">
                  Your application and CV are seen only by the people hiring for this role, and are deleted
                  six months after you apply. See the <a href="/privacy">Privacy Policy</a>.
                </p>
              </div>
              <ApplicationForm
                vacancy={{ id: vacancy.id, title: vacancy.title }}
                turnstileSiteKey={turnstileSiteKey()}
                idPrefix="vacancy"
              />
            </div>
          </section>
        ) : null}
      </main>
    </SiteLayout>
  );
}

function RoleSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="reveal flex flex-col gap-3.5">
      <h2 className="border-b border-line pb-3 text-[1.375rem] font-normal tracking-[-0.02em] text-ink">{title}</h2>
      {children}
    </section>
  );
}

function RoleList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <RoleSection title={title}>
      <ul className="flex list-disc flex-col gap-2.5 pl-5.5 text-base leading-[1.75] text-zinc-700 marker:text-rust">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </RoleSection>
  );
}

/** The role's facts, in a bordered column beside the description. */
function Facts({ vacancy, salary }: { vacancy: PublicVacancy; salary: string | null }) {
  const rows: Array<[string, string]> = [
    ['Type', VACANCY_TYPE_LABELS[vacancy.type]],
    ...(vacancy.department ? ([['Discipline', vacancy.department]] as Array<[string, string]>) : []),
    ['Location', vacancy.location],
    ...(vacancy.workPattern ? ([['Work pattern', WORK_PATTERN_LABELS[vacancy.workPattern]]] as Array<[string, string]>) : []),
    ...(salary ? ([['Salary', salary]] as Array<[string, string]>) : []),
    [
      vacancy.isOpen ? 'Closing date' : 'Closed',
      vacancy.closingDate ? formatClosingDate(vacancy.closingDate) : 'Open until filled',
    ],
  ];
  return (
    <dl className="flex flex-col">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-1 border-b border-line px-5 py-4 last:border-b-0">
          <dt className="text-[0.688rem] font-semibold tracking-[0.14em] text-zinc-600 uppercase">{label}</dt>
          <dd className="text-[0.938rem] leading-[1.5] break-words text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
