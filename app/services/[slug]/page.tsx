import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import CtaBand from '../../../components/CtaBand';
import PageHero from '../../../components/PageHero';
import SiteLayout from '../../../components/SiteLayout';
import {
  bodyCopy,
  cardBody,
  cardTitle,
  glyph,
  NOTICE_TEXT,
  notice,
  sectionHead,
  sectionLight,
  sectionMuted,
  titleMd,
  uppercaseLink,
} from '../../../components/sections';
import { btnOutlineOnDark, btnWhite, container, eyebrow, media } from '../../../components/ui';
import { STATUS_CLASS, STATUS_LABEL, cssUrl } from '../../projects/[slug]/project-shared';
import { loadServicePage, serviceSlugs, type ServiceProject } from '../load-services';
import { serviceHref } from '../services';

/**
 * Service detail — `/services/[slug]`.
 *
 * One page per published service, managed in the admin console. The page is
 * prerendered and regenerated at most once a minute, so an edit or a publish in
 * the console is live within the minute; a service published after the build
 * is rendered on its first request. Without a database the six built-in
 * services render from `../services.ts` (see `../load-services.ts`).
 *
 * The sections run overview and scope, process, benefits, deliverables, case
 * studies, related projects and the other disciplines, then the contact band.
 * Any section with nothing in it is left out, and the bands alternate white and
 * grey over whichever remain, so a missing section never leaves two of the same
 * colour running together.
 *
 * An informational service (Property Investment) renders the same shell with
 * its investment-facing parts removed — no "discuss your project" action, the
 * licensing notice carried at the top of the page rather than only at the foot
 * — because the brief marks it informational only and that has to be visible
 * before a reader scrolls.
 */

// Regenerated at most once a minute, like the landing page and /projects.
export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return serviceSlugs();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadServicePage(slug);
  if (!page) return { title: 'Service' };

  const { service } = page;
  const description = service.metaDescription ?? service.summary;

  return {
    // An editor's page title is the whole title, so the root layout's template
    // must not append the house name a second time.
    title: service.metaTitle ? { absolute: service.metaTitle } : service.title,
    description,
    openGraph: {
      type: 'website',
      title: `${service.title} — CoBuilt Investment Partners`,
      description,
    },
  };
}

/** A section band; the page sets `tone` so the remaining bands alternate. */
interface Band {
  key: string;
  render: (tone: string) => ReactNode;
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const page = await loadServicePage(slug);
  if (!page) notFound();

  const { service, caseStudies, relatedProjects, others } = page;

  const bands: Band[] = [
    {
      key: 'overview',
      render: (tone) => (
        <section key="overview" className={tone}>
          <div
            className={`${container} reveal-stagger grid grid-cols-1 items-start gap-8 md:grid-cols-[1.25fr_1fr] md:gap-14`}
          >
            <div className="flex flex-col gap-5">
              <p className={eyebrow}>Overview</p>
              {service.body.map((paragraph, index) => (
                <p key={index} className={bodyCopy}>
                  {paragraph}
                </p>
              ))}
              {!service.informational ? <p className={notice}>{NOTICE_TEXT}</p> : null}
            </div>

            {service.covers.length > 0 || service.suitedTo.length > 0 ? (
              <div className="flex flex-col gap-px border border-zinc-300 bg-zinc-300">
                {service.covers.length > 0 ? (
                  <div className="flex flex-col gap-3.5 bg-white p-6 sm:p-7.5">
                    <h2 className={`${cardTitle} tracking-[0.16em]`}>What this covers</h2>
                    <ul className="flex flex-col gap-2.5">
                      {service.covers.map((item, index) => (
                        <li
                          key={index}
                          className="flex gap-3 text-[0.906rem] leading-[1.6] text-zinc-700"
                        >
                          <span className="text-rust" aria-hidden="true">
                            ◈
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {service.suitedTo.length > 0 ? (
                  <div className="flex flex-col gap-3.5 bg-white p-6 sm:p-7.5">
                    <h2 className={`${cardTitle} tracking-[0.16em]`}>Suited to</h2>
                    <ul className="flex flex-col gap-2.5">
                      {service.suitedTo.map((item, index) => (
                        <li key={index} className="text-[0.906rem] leading-[1.6] text-zinc-700">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      ),
    },
  ];

  if (service.process.length > 0) {
    bands.push({
      key: 'process',
      render: (tone) => (
        <section key="process" className={tone} aria-labelledby="process-title">
          <div className={container}>
            <div className={`${sectionHead} max-w-165`}>
              <p className={eyebrow}>Process</p>
              <h2 className={titleMd} id="process-title">
                How the work runs
              </h2>
            </div>
            {/* The index page's "Working with CoBuilt" steps, ruled between columns. */}
            <ol className="reveal-stagger mt-8 grid grid-cols-1 gap-7 sm:mt-11 sm:grid-cols-2 sm:gap-x-0 sm:gap-y-9 md:grid-cols-4 md:gap-x-0">
              {service.process.map((step, index) => (
                <li
                  key={index}
                  className="flex flex-col gap-3.25 sm:border-r sm:border-zinc-300 sm:px-7 sm:max-md:odd:pl-0 sm:max-md:even:border-r-0 md:[&:nth-child(4n)]:border-r-0 md:[&:nth-child(4n)]:pr-0 md:[&:nth-child(4n+1)]:pl-0 sm:last:border-r-0"
                >
                  <span className="font-mono text-[2rem] leading-none font-light text-rust">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 className={`${cardTitle} tracking-[0.16em]`}>{step.title}</h3>
                  {step.body ? <p className={cardBody}>{step.body}</p> : null}
                </li>
              ))}
            </ol>
          </div>
        </section>
      ),
    });
  }

  if (service.benefits.length > 0) {
    bands.push({
      key: 'benefits',
      render: (tone) => (
        <section key="benefits" className={tone} aria-labelledby="benefits-title">
          <div className={container}>
            <div className={`${sectionHead} mb-8 max-w-165 sm:mb-11`}>
              <p className={eyebrow}>Benefits</p>
              <h2 className={titleMd} id="benefits-title">
                {service.informational ? 'Why the position is explained' : 'What it gives you'}
              </h2>
            </div>
            {/*
              Ruled with cell borders rather than the 1px gap over grey used
              elsewhere: the count is the editor's, and a short last row would
              otherwise show its empty cells as a grey block.
            */}
            <ul className="reveal grid grid-cols-1 border-t border-l border-zinc-300 sm:grid-cols-2 md:grid-cols-3">
              {service.benefits.map((benefit, index) => (
                <li
                  key={index}
                  className="flex flex-col gap-3 border-r border-b border-zinc-300 bg-white p-6 sm:p-7.5"
                >
                  <span className={`${glyph} text-orange`} aria-hidden="true">
                    ◈
                  </span>
                  <h3 className={`${cardTitle} tracking-[0.16em]`}>{benefit.title}</h3>
                  {benefit.body ? <p className={cardBody}>{benefit.body}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ),
    });
  }

  if (service.deliverables.length > 0) {
    bands.push({
      key: 'deliverables',
      render: (tone) => (
        <section key="deliverables" className={tone} aria-labelledby="deliverables-title">
          <div className={container}>
            <div className={`${sectionHead} mb-8 max-w-165 sm:mb-11`}>
              <p className={eyebrow}>
                {service.informational ? 'What you get today' : 'What you are handed'}
              </p>
              <h2 className={titleMd} id="deliverables-title">
                {service.informational
                  ? 'Information, and nothing presented as an offer'
                  : 'Documents, not assurances'}
              </h2>
            </div>

            <ol className="reveal grid grid-cols-1 gap-px border border-zinc-300 bg-zinc-300 sm:grid-cols-2">
              {service.deliverables.map((item, index) => (
                <li key={index} className="flex flex-col gap-3 bg-white p-6 sm:p-7.5">
                  <span className="font-mono text-[1.5rem] leading-none font-light text-rust">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <p className="text-[0.969rem] leading-[1.7] text-ink">{item}</p>
                </li>
              ))}
            </ol>

            <p className="mt-7 text-[0.906rem] leading-[1.7] text-zinc-700">
              Everything recorded against a mandatory milestone is published to that
              development&rsquo;s{' '}
              <a className="text-rust underline hover:text-rust-hover" href="/passport">
                Project Passport™
              </a>
              , where anyone can check it.
            </p>
          </div>
        </section>
      ),
    });
  }

  if (caseStudies.length > 0) {
    bands.push({
      key: 'case-studies',
      render: (tone) => (
        <section key="case-studies" className={tone} aria-labelledby="case-studies-title">
          <div className={container}>
            <div className={`${sectionHead} mb-8 max-w-165 sm:mb-11`}>
              <p className={eyebrow}>Case studies</p>
              <h2 className={titleMd} id="case-studies-title">
                {service.title} in practice
              </h2>
            </div>
            <div className="reveal-stagger grid grid-cols-1 gap-6 md:grid-cols-2">
              {caseStudies.map((project) => (
                <ProjectCard key={project.id} project={project} large />
              ))}
            </div>
          </div>
        </section>
      ),
    });
  }

  if (relatedProjects.length > 0) {
    bands.push({
      key: 'related',
      render: (tone) => (
        <section key="related" className={tone} aria-labelledby="related-title">
          <div className={container}>
            <div className="mb-8 flex flex-col gap-5 sm:mb-11 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
              <div className={`${sectionHead} max-w-165`}>
                <p className={eyebrow}>Related projects</p>
                <h2 className={titleMd} id="related-title">
                  {caseStudies.length > 0 ? 'More of this work' : 'Where this work is happening'}
                </h2>
              </div>
              <a
                className={`${uppercaseLink} inline-flex min-h-target items-center self-start text-[0.719rem] sm:self-auto`}
                href="/projects"
              >
                All projects →
              </a>
            </div>
            <div className="reveal-stagger grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
              {relatedProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>
        </section>
      ),
    });
  }

  if (others.length > 0) {
    bands.push({
      key: 'others',
      render: (tone) => (
        <section key="others" className={tone} aria-labelledby="other-services-title">
          <div className={container}>
            <div className={`${sectionHead} mb-7 max-w-165 sm:mb-9`}>
              <p className={eyebrow}>The other disciplines</p>
              <h2 className={titleMd} id="other-services-title">
                Often engaged alongside this
              </h2>
            </div>

            {/* Cell borders, as for the benefits: the number of services is the console's. */}
            <div className="reveal grid grid-cols-1 border-t border-l border-zinc-300 sm:grid-cols-2 md:grid-cols-3">
              {others.map((item) => (
                <article
                  key={item.slug}
                  className={`flex flex-col gap-3 border-r border-b border-zinc-300 p-6 sm:p-7.5 ${item.informational ? 'bg-zinc-50' : 'bg-white'}`}
                >
                  <span
                    className={`${glyph} ${item.informational ? 'text-zinc-500' : 'text-orange'}`}
                    aria-hidden="true"
                  >
                    ◈
                  </span>
                  <h3 className={`${cardTitle} tracking-[0.16em]`}>{item.title}</h3>
                  <p className={cardBody}>{item.summary}</p>
                  <a
                    className={`${uppercaseLink} mt-auto inline-flex min-h-target items-center self-start pt-2 text-[0.719rem]`}
                    href={serviceHref(item.slug)}
                  >
                    {item.informational ? 'Read the position →' : 'Learn more →'}
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>
      ),
    });
  }

  return (
    <SiteLayout current="/services">
      <main>
        <PageHero
          eyebrow={service.informational ? 'Information only' : 'Our services'}
          title={service.title}
          standfirst={service.standfirst || service.summary}
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Services', href: '/services' },
            { label: service.title },
          ]}
          actions={
            service.informational ? (
              <a className={btnOutlineOnDark} href="/#register">
                Register your interest
              </a>
            ) : (
              <>
                <a className={btnWhite} href="/contact">
                  Discuss your project
                </a>
                <a className={btnOutlineOnDark} href="/projects">
                  See the work
                </a>
              </>
            )
          }
        />

        {service.informational ? (
          <section className="border-b border-line bg-zinc-100 py-7 sm:py-9">
            <div className={container}>
              <div className="flex flex-col gap-2.5 border-l-3 border-orange bg-white px-5.5 py-5">
                <p className="text-[0.719rem] font-bold uppercase tracking-[0.16em] text-ink">
                  Regulatory position
                </p>
                <p className="text-[0.906rem] leading-[1.75] text-zinc-700">{NOTICE_TEXT}</p>
              </div>
            </div>
          </section>
        ) : null}

        {bands.map((band, index) => band.render(index % 2 === 0 ? sectionLight : sectionMuted))}

        {service.informational ? (
          <CtaBand
            eyebrow="While the licences are outstanding"
            title="Register interest, and we will write when the position changes"
            body="No offer, no obligation, and no investment solicited. You will receive project updates and company news, and notice if an Investor Portal is ever introduced."
            notice
          />
        ) : (
          <CtaBand
            title={`Talk to us about ${service.title.toLowerCase()}`}
            body="Send the site, the brief or the problem, and we will come back with a view on feasibility, programme and cost — in writing."
            notice
          />
        )}
      </main>
    </SiteLayout>
  );
}

/**
 * A project on a service page: the project page's own "other developments"
 * card, with the photograph taller and the description shown for a case study.
 */
function ProjectCard({ project, large }: { project: ServiceProject; large?: boolean }) {
  return (
    <article className="flex flex-col border border-line bg-white">
      {project.featuredImageUrl ? (
        <div
          className={`${media} ${large ? 'h-64 sm:h-72' : 'h-56'}`}
          style={{ backgroundImage: cssUrl(project.featuredImageUrl) }}
          role="img"
          aria-label={project.title}
        />
      ) : null}
      <div className="flex flex-1 flex-col gap-2.5 p-5.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[0.656rem] uppercase tracking-[0.16em] text-zinc-600">
            {project.location ?? 'Location to follow'}
          </span>
          <span className={STATUS_CLASS[project.status]}>{STATUS_LABEL[project.status]}</span>
        </div>
        <h3 className="text-[1.313rem] font-normal tracking-[-0.02em]">
          <a className="text-ink hover:text-rust" href={`/projects/${project.slug}`}>
            {project.title}
          </a>
        </h3>
        {large && project.description ? <p className={cardBody}>{project.description}</p> : null}
        <div className="mt-auto pt-3">
          <a className={uppercaseLink} href={`/projects/${project.slug}`}>
            <span className="sr-only">{project.title} — </span>
            {large ? 'Read the case study →' : 'View →'}
          </a>
        </div>
      </div>
    </article>
  );
}
