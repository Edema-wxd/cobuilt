import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
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
import { btnOutlineOnDark, btnWhite, container, eyebrow } from '../../../components/ui';
import { SERVICES, findService, serviceHref } from '../services';

/**
 * Service detail — `/services/[slug]`.
 *
 * Six static pages, one per discipline, generated from `../services.ts`. The
 * route is fully prerendered: the content does not come from the API, so there
 * is nothing to render per request.
 *
 * Property Investment renders the same shell with its investment-facing parts
 * removed — no "discuss your project" action, the licensing notice carried at
 * the top of the page rather than only at the foot — because the brief marks it
 * informational only and that has to be visible before a reader scrolls.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return SERVICES.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const service = findService(slug);
  if (!service) return { title: 'Service' };

  return {
    title: service.title,
    description: service.summary,
    openGraph: {
      type: 'website',
      title: `${service.title} — CoBuilt Investment Partners`,
      description: service.summary,
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const service = findService(slug);
  if (!service) notFound();

  const others = SERVICES.filter((item) => item.slug !== service.slug);

  return (
    <SiteLayout current="/services">
      <main>
        <PageHero
          eyebrow={service.informational ? 'Information only' : 'Our services'}
          title={service.title}
          standfirst={service.standfirst}
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

        <section className={sectionLight}>
          <div
            className={`${container} reveal-stagger grid grid-cols-1 items-start gap-8 md:grid-cols-[1.25fr_1fr] md:gap-14`}
          >
            <div className="flex flex-col gap-5">
              <p className={eyebrow}>Overview</p>
              {service.body.map((paragraph) => (
                <p key={paragraph.slice(0, 32)} className={bodyCopy}>
                  {paragraph}
                </p>
              ))}
              {!service.informational ? (
                <p className={notice}>{NOTICE_TEXT}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-px border border-zinc-300 bg-zinc-300">
              <div className="flex flex-col gap-3.5 bg-white p-6 sm:p-7.5">
                <h2 className={`${cardTitle} tracking-[0.16em]`}>What this covers</h2>
                <ul className="flex flex-col gap-2.5">
                  {service.covers.map((item) => (
                    <li
                      key={item}
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
              <div className="flex flex-col gap-3.5 bg-white p-6 sm:p-7.5">
                <h2 className={`${cardTitle} tracking-[0.16em]`}>Suited to</h2>
                <ul className="flex flex-col gap-2.5">
                  {service.suitedTo.map((item) => (
                    <li key={item} className="text-[0.906rem] leading-[1.6] text-zinc-700">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className={sectionMuted} aria-labelledby="deliverables-title">
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
                <li key={item} className="flex flex-col gap-3 bg-white p-6 sm:p-7.5">
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

        <section className={sectionLight} aria-labelledby="other-services-title">
          <div className={container}>
            <div className={`${sectionHead} mb-7 max-w-165 sm:mb-9`}>
              <p className={eyebrow}>The other disciplines</p>
              <h2 className={titleMd} id="other-services-title">
                Often engaged alongside this
              </h2>
            </div>

            <div className="reveal grid grid-cols-1 gap-px border border-zinc-300 bg-zinc-300 sm:grid-cols-2 md:grid-cols-3">
              {others.map((item) => (
                <article
                  key={item.slug}
                  className={`flex flex-col gap-3 p-6 sm:p-7.5 ${item.informational ? 'bg-zinc-50' : 'bg-white'}`}
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
