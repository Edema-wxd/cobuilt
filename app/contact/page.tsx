import type { Metadata } from 'next';
import PageHero from '../../components/PageHero';
import SiteLayout from '../../components/SiteLayout';
import ContactForm from './contact-form';
import { ADDRESS_LINES, EMAIL, PHONE, PHONE_HREF, WHATSAPP_HREF } from '../../components/site';
import {
  bodyCopy,
  cardBody,
  cardTitle,
  glyph,
  NOTICE_TEXT,
  sectionHead,
  sectionLight,
  sectionMuted,
  titleMd,
} from '../../components/sections';
import { container, eyebrow, eyebrowOnLine } from '../../components/ui';

/**
 * Contact — `/contact`.
 *
 * The nav's Contact item pointed at the landing page's newsletter band, which
 * is a different thing: registering for updates is not sending an enquiry, and
 * the two post to different endpoints. This page carries the enquiry form
 * (`/api/forms/inquiry`) and the channels — office, phone, email, WhatsApp
 * Business — while the landing band keeps the newsletter.
 *
 * No map: there is no map integration in the build, and the handover leaves
 * whether to add one open (§3.6). The address and hours are given in text,
 * which is what a visitor needs to find the office anyway.
 */

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Contact CoBuilt Investment Partners — the Lagos office, phone, email and WhatsApp Business, and an enquiry form that reaches a person within one working day.',
};

const CHANNELS: Array<{ head: string; lines: Array<{ text: string; href?: string }>; note: string }> =
  [
    {
      head: 'Call the office',
      lines: [{ text: PHONE, href: PHONE_HREF }],
      note: 'Monday to Friday, 08:00–17:00 WAT. The quickest route for anything urgent.',
    },
    {
      head: 'Email',
      lines: [{ text: EMAIL, href: `mailto:${EMAIL}` }],
      note: 'General enquiries, press requests and speculative applications all reach this address.',
    },
    {
      head: 'WhatsApp Business',
      lines: [{ text: 'Message the business line', href: WHATSAPP_HREF }],
      note: 'Opens WhatsApp on the same number as the office line. Replies in working hours.',
    },
  ];

const ROUTES: Array<[string, string]> = [
  [
    'A site or a scheme',
    'Land, a brief, or a development you want appraised. Expect a written view on feasibility, programme and cost.',
  ],
  [
    'A question about a project record',
    'Anything in a Project Passport™ — a date, a certificate, a photograph. Quote the project ID if you have it.',
  ],
  [
    'Press and media',
    'Interviews, imagery and footage. The press desk handles these; say your outlet and deadline.',
  ],
  [
    'Suppliers and contractors',
    'Prequalification and tendering. Tell us the trade and the projects you have delivered.',
  ],
];

export default function Contact() {
  return (
    <SiteLayout current="/contact">
      <main>
        <PageHero
          eyebrow="Contact"
          title={
            <>
              Tell us what you need, and <em>who to route it to</em>.
            </>
          }
          standfirst="One enquiry form, read by a person, answered within one working day. The office line is open Monday to Friday, 08:00–17:00 WAT."
        />

        <section className="bg-line py-13 sm:py-16 md:py-20" id="enquiry">
          <div
            className={`${container} grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-13`}
          >
            <div className="flex flex-col gap-5 [&_h2_em]:text-rust">
              <p className={eyebrowOnLine}>Send an enquiry</p>
              <h2 className={titleMd}>
                We reply to <em>every</em> enquiry.
              </h2>
              <p className="text-[0.969rem] leading-[1.75] text-zinc-700">
                Give us enough detail to route it properly and you will get a considered answer
                rather than a holding reply.
              </p>

              <div className="flex flex-col gap-px border border-zinc-400 bg-zinc-400">
                {CHANNELS.map((channel) => (
                  <div key={channel.head} className="flex flex-col gap-1.5 bg-white p-5 sm:p-5.5">
                    <p className="text-[0.656rem] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                      {channel.head}
                    </p>
                    {channel.lines.map((line) => (
                      <p key={line.text} className="text-[1.0625rem] text-ink">
                        {line.href ? (
                          <a
                            className="inline-flex min-h-target items-center text-rust underline hover:text-rust-hover sm:min-h-0"
                            href={line.href}
                          >
                            {line.text}
                          </a>
                        ) : (
                          line.text
                        )}
                      </p>
                    ))}
                    <p className="text-[0.844rem] leading-[1.65] text-zinc-600">{channel.note}</p>
                  </div>
                ))}
              </div>

              {/* The regulatory position, which the brief requires on every investor path. */}
              <p className="border-l-3 border-orange pl-4 text-[0.844rem] leading-[1.7] text-zinc-700">
                {NOTICE_TEXT}
              </p>
            </div>

            <ContactForm />
          </div>
        </section>

        <section className={sectionLight}>
          <div
            className={`${container} grid grid-cols-1 items-start gap-8 md:grid-cols-[1fr_1.25fr] md:gap-14`}
          >
            <div className="flex flex-col gap-5">
              <p className={eyebrow}>The office</p>
              <h2 className={titleMd}>Where to find us</h2>
              <address className="flex flex-col gap-1 text-base leading-[1.8] text-zinc-700 not-italic">
                {ADDRESS_LINES.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </address>
              <p className={bodyCopy}>
                Visits are by appointment, so that whoever you need is actually in the building.
                Site visits to a development under construction are arranged separately and require
                a safety induction.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-px border border-zinc-300 bg-zinc-300 sm:grid-cols-2">
              {ROUTES.map(([head, body]) => (
                <div key={head} className="flex flex-col gap-3 bg-white p-6 sm:p-7.5">
                  <span className={`${glyph} text-orange`} aria-hidden="true">
                    ◈
                  </span>
                  <h3 className={`${cardTitle} tracking-[0.16em]`}>{head}</h3>
                  <p className={cardBody}>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={sectionMuted}>
          <div className={container}>
            <div className={`${sectionHead} mb-6 max-w-165 sm:mb-8`}>
              <p className={eyebrow}>What happens to your details</p>
              <h2 className={titleMd}>Held only as long as the enquiry needs</h2>
            </div>
            <div className="flex max-w-190 flex-col gap-4">
              <p className={bodyCopy}>
                Your enquiry is stored so that someone can answer it, and it is retained under the
                schedule set out in our{' '}
                <a className="text-rust underline hover:text-rust-hover" href="/privacy">
                  Privacy Policy
                </a>{' '}
                — not indefinitely. Nigeria&rsquo;s Data Protection Act gives you the right to ask
                what we hold, to have it corrected, and to have it deleted; that policy explains how
                to exercise each one.
              </p>
              <p className={bodyCopy}>
                Registering for updates is separate, and separately consented: the{' '}
                <a className="text-rust underline hover:text-rust-hover" href="/#register">
                  register your interest
                </a>{' '}
                form on the home page is double opt-in and every email carries an unsubscribe link.
              </p>
            </div>
          </div>
        </section>
      </main>
    </SiteLayout>
  );
}
