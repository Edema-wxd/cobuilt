import type { Metadata } from 'next';
import PageHero from '../../components/PageHero';
import SiteLayout from '../../components/SiteLayout';
import { EMAIL } from '../../components/site';
import {
  bodyCopy,
  cardBody,
  cardTitle,
  sectionHead,
  sectionLight,
  sectionMuted,
  titleMd,
  titleSm,
} from '../../components/sections';
import { btnOrange, btnOutlineOnDark, container, eyebrow, eyebrowOnLine } from '../../components/ui';
import { canonical } from '@/lib/seo';
import { turnstileSiteKey } from '@/lib/turnstile';
import type { VacancyType } from '@/lib/careers';
import ApplicationForm from './application-form';
import { VacancyList } from './careers-shared';
import { loadOpenVacancies, type PublicVacancy } from './load-careers';

/**
 * Careers — `/careers`.
 *
 * The vacancies published at `/admin/careers` and still open, grouped by type
 * — the standing roles first, then graduate opportunities and the internship
 * programme, each called out on its own — then how we work, the disciplines
 * we hire into, and the speculative application form, with the equal
 * opportunity statement and what happens to an applicant's data beside it.
 * Each vacancy opens at `/careers/[slug]` with its own form
 * (docs/decisions.md §2.28).
 *
 * A vacancy leaves this page once its closing date (West Africa Time) has
 * passed. No role is invented: with none open the page says so, and the
 * speculative form is always there. Read on the server and regenerated at
 * most once a minute; with no database it says the vacancies could not be
 * loaded, and the speculative form still works once the API can be reached.
 */

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Working at CoBuilt',
  description:
    'Careers at CoBuilt Investment Partners — current vacancies, graduate opportunities and internships, how we work, the disciplines we hire into, and how to apply online.',
  alternates: canonical('/careers'),
};

/** The standing roles, listed first in this order. */
const STANDING: Array<{ type: Exclude<VacancyType, 'graduate' | 'internship'>; id: string }> = [
  { type: 'full_time', id: 'full-time' },
  { type: 'part_time', id: 'part-time' },
  { type: 'contract', id: 'contract' },
];

const DISCIPLINES = [
  'Development and project management',
  'Construction management and site supervision',
  'Quantity surveying and cost control',
  'Architecture and design coordination',
  'Sales, client relations and marketing',
  'Finance, legal and compliance',
  'Technology and data',
];

/** The plural headings the standing groups take. */
const GROUP_TITLES: Record<(typeof STANDING)[number]['type'], string> = {
  full_time: 'Full-time roles',
  part_time: 'Part-time roles',
  contract: 'Contract roles',
};

export default async function Careers() {
  const data = await loadOpenVacancies();
  const vacancies = data.kind === 'ready' ? data.vacancies : [];
  const ofType = (type: VacancyType) => vacancies.filter((vacancy) => vacancy.type === type);
  const groups = STANDING.map((group) => ({ ...group, vacancies: ofType(group.type) })).filter(
    (group) => group.vacancies.length > 0,
  );
  const graduate = ofType('graduate');
  const internship = ofType('internship');
  const siteKey = turnstileSiteKey();

  return (
    <SiteLayout current="/careers">
      <main>
        <PageHero
          eyebrow="Careers"
          title={
            <>
              Working at <em>CoBuilt</em>
            </>
          }
          standfirst="We build in the open, and we hire people who are comfortable working that way."
          trail={[{ label: 'Home', href: '/' }, { label: 'Careers' }]}
          actions={
            <>
              <a className={btnOrange} href="#vacancies">
                {vacancies.length > 0 ? 'See current vacancies' : 'Current vacancies'}
              </a>
              <a className={btnOutlineOnDark} href="#apply">
                Send a speculative application
              </a>
            </>
          }
        />

        <section className={sectionLight} id="vacancies" aria-labelledby="vacancies-title">
          <div className={container}>
            <div className={`${sectionHead} mb-8 max-w-165 sm:mb-10`}>
              <p className={eyebrow}>Current vacancies</p>
              <h2 className={titleMd} id="vacancies-title">
                Open roles
              </h2>
              <p className={bodyCopy}>
                Each role sets out what it involves, what it asks for, what comes with it and when it
                closes. Apply online with your CV; it goes to our hiring team and nobody else.
              </p>
            </div>

            {data.kind === 'unavailable' ? (
              <Note title="Vacancies could not be loaded">
                This is on our side. Try again in a minute — or send a speculative application below,
                which reaches the same people.
              </Note>
            ) : groups.length === 0 ? (
              <Note title="No open roles at present">
                We are not advertising a role right now. Open roles are listed on this page when they
                arise, with the scope, location and closing date for each. Speculative applications are
                welcome in the meantime.
              </Note>
            ) : (
              <div className="flex flex-col gap-10 sm:gap-12">
                {groups.map((group) => (
                  <section key={group.id} aria-labelledby={`${group.id}-title`}>
                    <h3
                      className="mb-5 border-b border-ink pb-3 text-[0.781rem] font-semibold tracking-[0.16em] text-ink uppercase"
                      id={`${group.id}-title`}
                    >
                      {GROUP_TITLES[group.type]}
                    </h3>
                    <VacancyList vacancies={group.vacancies} />
                  </section>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className={sectionMuted} id="early-careers" aria-labelledby="early-careers-title">
          <div className={container}>
            <div className={`${sectionHead} mb-8 max-w-165 sm:mb-10`}>
              <p className={eyebrow}>Early careers</p>
              <h2 className={titleMd} id="early-careers-title">
                Graduate opportunities and internships
              </h2>
              <p className={bodyCopy}>
                Graduate roles and internships are advertised here when they open, each with what it
                involves, how long it runs and when it closes. You apply for them the same way as any
                other role.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-13">
              <Programme
                id="graduate"
                title="Graduate opportunities"
                body="For recent graduates in one of the disciplines we hire into."
                vacancies={graduate}
                available={data.kind === 'ready'}
                none="No graduate intake is open at present. When one is, it is listed here with its closing date."
              />
              <Programme
                id="internship"
                title="Internship programme"
                body="For students and recent graduates who want a fixed period of work experience. Each internship says how long it runs and what it covers."
                vacancies={internship}
                available={data.kind === 'ready'}
                none="No internships are open at present. When they are, they are listed here with their dates."
              />
            </div>
          </div>
        </section>

        <section className={sectionLight} id="culture" aria-labelledby="culture-title">
          <div className={`${container} grid grid-cols-1 gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-16`}>
            <div className={sectionHead}>
              <p className={eyebrow}>Company culture</p>
              <h2 className={titleMd} id="culture-title">
                How we work
              </h2>
              <p className={bodyCopy}>
                Every CoBuilt development carries a Project Passport™: a dated, public record of each
                milestone, with the site photography, progress reports and certificates attached. That
                commitment shapes the job. Work is documented as it happens, programmes are published
                before they are met, and a slipped date is reported rather than quietly revised.
              </p>
              <p className={bodyCopy}>
                It suits people who would rather answer a question with a document than an assurance.
              </p>
            </div>
            <div className="reveal flex flex-col gap-4">
              <h3 className={`${cardTitle} tracking-[0.16em]`}>Disciplines we hire into</h3>
              <ul className="flex flex-col border-t border-line">
                {DISCIPLINES.map((discipline) => (
                  <li key={discipline} className="border-b border-line py-3 text-[0.969rem] leading-[1.6] text-zinc-700">
                    {discipline}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="scroll-mt-24 bg-line py-13 sm:py-16 md:py-20" id="apply" aria-labelledby="apply-title">
          <div
            className={`${container} grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-13`}
          >
            <div className="reveal flex flex-col gap-5">
              <p className={eyebrowOnLine}>Speculative applications</p>
              <h2 className={titleSm} id="apply-title">
                Sending a speculative application
              </h2>
              <p className="text-[0.969rem] leading-[1.75] text-zinc-700">
                No role that fits? Send your CV with a short note: the discipline you work in, and a
                project you delivered and what you would do differently next time. We read every
                application and reply either way. If the form will not work for you, email{' '}
                <a className="text-rust-hover underline" href={`mailto:${EMAIL}?subject=Careers`}>
                  {EMAIL}
                </a>{' '}
                with &ldquo;Careers&rdquo; in the subject line instead.
              </p>

              <div className="flex flex-col gap-2.5 border-t border-zinc-400 pt-5">
                <h3 className={`${cardTitle} tracking-[0.16em]`}>Equal opportunity</h3>
                <p className="text-[0.906rem] leading-[1.7] text-zinc-700">
                  CoBuilt Investment Partners recruits on merit. We do not discriminate on the basis of
                  gender, ethnicity, religion, age, disability or state of origin, and we will make
                  reasonable adjustments at any stage of the process — tell us what you need.
                </p>
              </div>

              <div className="flex flex-col gap-2.5 border-t border-zinc-400 pt-5">
                <h3 className={`${cardTitle} tracking-[0.16em]`}>What happens to your application</h3>
                <p className="text-[0.906rem] leading-[1.7] text-zinc-700 [&_a]:text-rust-hover [&_a]:underline">
                  Your details and CV are seen only by the people at CoBuilt who are hiring. We do not
                  pass them to recruiters or anyone else; our hosting provider stores them for us. We keep them for six months from the day you apply and
                  then delete them, CV included. You can ask to see them, correct them or have them
                  deleted sooner; our <a href="/privacy">Privacy Policy</a> explains how.
                </p>
              </div>
            </div>

            <ApplicationForm vacancy={null} turnstileSiteKey={siteKey} idPrefix="speculative" />
          </div>
        </section>
      </main>
    </SiteLayout>
  );
}

function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="reveal flex max-w-165 flex-col gap-2.5 border-l-3 border-orange bg-zinc-100 px-5.5 py-5">
      <p className="text-[0.719rem] font-bold tracking-[0.16em] text-ink uppercase">{title}</p>
      <p className="text-[0.906rem] leading-[1.75] text-zinc-700">{children}</p>
    </div>
  );
}

/** Graduate opportunities or the internship programme: what it is, then its open vacancies or a note. */
function Programme({
  id,
  title,
  body,
  vacancies,
  available,
  none,
}: {
  id: string;
  title: string;
  body: string;
  vacancies: PublicVacancy[];
  /** False when the vacancies could not be read, so "none open" would not be known to be true. */
  available: boolean;
  none: string;
}) {
  return (
    <section className="flex flex-col gap-4" id={id} aria-labelledby={`${id}-title`}>
      <h3
        className="border-b border-ink pb-3 text-[0.781rem] font-semibold tracking-[0.16em] text-ink uppercase"
        id={`${id}-title`}
      >
        {title}
        {vacancies.length > 0 ? (
          <span className="ml-2 font-mono font-normal tracking-[0.04em] text-zinc-600 normal-case">
            {vacancies.length} open
          </span>
        ) : null}
      </h3>
      <p className={cardBody}>{body}</p>
      {vacancies.length > 0 ? (
        <VacancyList vacancies={vacancies} columns={1} />
      ) : (
        <p className="border border-zinc-300 bg-white px-5 py-4 text-[0.906rem] leading-[1.7] text-zinc-700">
          {available ? none : 'Openings could not be loaded just now. Try again in a minute.'}
        </p>
      )}
    </section>
  );
}
