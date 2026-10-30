import type { Metadata } from 'next';
import CtaBand from '../../components/CtaBand';
import PageHero from '../../components/PageHero';
import SiteLayout from '../../components/SiteLayout';
import {
  bodyCopy,
  cardBody,
  cardTitle,
  glyph,
  sectionHead,
  sectionLight,
  sectionMuted,
  titleLg,
  titleMd,
  uppercaseLink,
} from '../../components/sections';
import { btnWhite, btnOutlineOnDark, container, eyebrow } from '../../components/ui';
import { SERVICES, serviceHref } from './services';

/**
 * Services index — `/services`.
 *
 * The landing page's six service cards each carried a "Learn more →" link that
 * went to the newsletter form. They now go to `/services/[slug]`, and this page
 * is where the nav's Services item lands.
 *
 * The six cards are the landing page's own grid, which is the pattern the
 * handover says to extend rather than replace.
 */

export const metadata: Metadata = {
  title: 'Services',
  description:
    'Six disciplines delivered under one governance framework by CoBuilt Investment Partners — development, construction management, development management, advisory, asset management, and property investment information.',
};

const STEPS: Array<[string, string, string]> = [
  ['01', 'Enquire', 'Tell us about the site, brief or scheme you have in mind.'],
  [
    '02',
    'Appraise',
    'We prepare a feasibility appraisal covering market, technical and cost position.',
  ],
  ['03', 'Deliver', 'Design, procurement and construction managed against a published programme.'],
  ['04', 'Hand over', 'Practical completion, documentation and a permanent Passport archive.'],
];

export default function Services() {
  return (
    <SiteLayout current="/services">
      <main>
        <PageHero
          eyebrow="Our services"
          title={
            <>
              Six disciplines, one <em>governance</em> framework.
            </>
          }
          standfirst="From feasibility through to practical completion, handover and the operation of the finished asset — delivered by one organisation and recorded as the work happens."
          actions={
            <>
              <a className={btnWhite} href="/contact">
                Discuss your project
              </a>
              <a className={btnOutlineOnDark} href="/projects">
                See the work
              </a>
            </>
          }
        />

        <section className={sectionLight}>
          <div className={container}>
            <div className={`${sectionHead} mb-8 max-w-165 sm:mb-11`}>
              <p className={eyebrow}>What we do</p>
              <h2 className={titleLg}>Choose the discipline you need</h2>
              <p className={bodyCopy}>
                Each of these can be engaged on its own, or together as a single appointment from
                acquisition to asset management.
              </p>
            </div>

            {/* The 1px gap over a grey ground draws the rules between cards. */}
            <div className="reveal grid grid-cols-1 gap-px border border-zinc-300 bg-zinc-300 sm:grid-cols-2 md:grid-cols-3">
              {SERVICES.map((service) => (
                <article
                  key={service.slug}
                  className={`flex flex-col gap-3 p-6 sm:p-8.5 ${service.informational ? 'bg-zinc-50' : 'bg-white'}`}
                >
                  <span
                    className={`${glyph} ${service.informational ? 'text-zinc-500' : 'text-orange'}`}
                    aria-hidden="true"
                  >
                    ◈
                  </span>
                  <h3 className={`${cardTitle} tracking-[0.16em]`}>{service.title}</h3>
                  <p className={cardBody}>{service.summary}</p>
                  {service.informational ? (
                    <p className="mt-1.5 self-start border border-zinc-400 px-2.5 py-1.5 text-[0.656rem] font-bold tracking-[0.16em] text-zinc-700 uppercase">
                      Informational
                    </p>
                  ) : null}
                  <a
                    className={`${uppercaseLink} mt-auto inline-flex min-h-target items-center self-start pt-2 text-[0.719rem]`}
                    href={serviceHref(service.slug)}
                  >
                    {service.informational ? 'Read the position →' : 'Learn more →'}
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={sectionMuted} aria-labelledby="how-title">
          <div className={container}>
            <div className={sectionHead}>
              <p className={eyebrow}>How it works</p>
              <h2 className={titleMd} id="how-title">
                Working with CoBuilt
              </h2>
            </div>
            <ol className="mt-8 grid grid-cols-1 gap-7 sm:mt-11 sm:grid-cols-2 sm:gap-x-0 sm:gap-y-9 md:grid-cols-4 md:gap-0">
              {STEPS.map(([number, title, body]) => (
                <li
                  key={number}
                  className="flex flex-col gap-3.25 sm:border-r sm:border-zinc-300 sm:px-7 sm:first:pl-0 sm:last:border-r-0 sm:last:pr-0 sm:max-md:odd:pl-0 sm:max-md:even:border-r-0"
                >
                  <span className="font-mono text-[2rem] leading-none font-light text-rust">
                    {number}
                  </span>
                  <h3 className={`${cardTitle} tracking-[0.16em]`}>{title}</h3>
                  <p className={cardBody}>{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <CtaBand
          title="Tell us what you are trying to build"
          body="Send the site, the brief or the problem. We will tell you which of the six disciplines you actually need — including when the answer is none of them yet."
          notice
        />
      </main>
    </SiteLayout>
  );
}
