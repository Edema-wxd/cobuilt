import type { Metadata } from 'next';
import PageHero from '../../components/PageHero';
import SiteLayout from '../../components/SiteLayout';
import ContactForm from './contact-form';
import OfficeMap from './office-map';
import { loadContactSettings } from './load-contact';
import { hoursText, telHref, whatsappHref } from '@/lib/contactDetails';
import { turnstileSiteKey } from '@/lib/turnstile';
import type { ContactSettings } from '@/lib/schemas/settings';
import type { EnquiryType } from '@/lib/enquiryTypes';
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
  uppercaseLink,
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
 * The address, phones, emails, WhatsApp number, hours and map position are
 * set at `/admin/contact` and read on the server, falling back to the details
 * in components/site.ts (docs/decisions.md §2.25); the page regenerates at
 * most once a minute. The address and hours are given in text, which is what
 * a visitor needs to find the office anyway. The map beneath them is
 * click-to-load and appears only once a confirmed position is set
 * (docs/decisions.md §2.17).
 *
 * Each route an enquiry can take links into the form with its enquiry type
 * chosen, so a partnership, press or supplier enquiry arrives labelled.
 */

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Contact CoBuilt Investment Partners — the Lagos office, phone, email and WhatsApp Business, and an enquiry form that reaches a person within one working day.',
};

interface Channel {
  head: string;
  lines: Array<{ text: string; href?: string; label?: string }>;
  note: string;
}

function channelsFor(settings: ContactSettings): Channel[] {
  const hours = hoursText(settings.hours);
  // A label is only worth showing when there is more than one to tell apart.
  const labelled = <T,>(items: T[], label: (item: T) => string) =>
    items.length > 1 ? label : () => undefined;
  const phoneLabel = labelled(settings.phones, (phone) => phone.label);
  const emailLabel = labelled(settings.emails, (email) => email.label);

  return [
    {
      head: settings.phones.length > 1 ? 'Call us' : 'Call the office',
      lines: settings.phones.map((phone) => ({
        text: phone.number,
        href: telHref(phone.number),
        label: phoneLabel(phone),
      })),
      note: `${hours}. The quickest route for anything urgent.`,
    },
    {
      head: 'Email',
      lines: settings.emails.map((email) => ({
        text: email.address,
        href: `mailto:${email.address}`,
        label: emailLabel(email),
      })),
      note: 'General enquiries, press requests and speculative applications all reach a person.',
    },
    ...(settings.whatsapp
      ? [
          {
            head: 'WhatsApp Business',
            lines: [{ text: 'Message the business line', href: whatsappHref(settings.whatsapp) }],
            note: `Opens WhatsApp on ${settings.whatsapp}. Replies in working hours.`,
          },
        ]
      : []),
  ];
}

const ROUTES: Array<{ head: string; body: string; type: EnquiryType; action: string }> = [
  {
    head: 'A site or a scheme',
    body: 'Land, a brief, or a development you want appraised. Expect a written view on feasibility, programme and cost.',
    type: 'project',
    action: 'Discuss a project',
  },
  {
    head: 'Partnerships',
    body: 'Joint ventures, landowners and institutions. Tell us who you represent and what you have in mind.',
    type: 'partnership',
    action: 'Make a partnership enquiry',
  },
  {
    head: 'A question about a project record',
    body: 'Anything in a Project Passport™ — a date, a certificate, a photograph. Quote the project ID if you have it.',
    type: 'project_record',
    action: 'Ask about a record',
  },
  {
    head: 'Press and media',
    body: 'Interviews, imagery and footage. The press desk handles these; say your outlet and deadline.',
    type: 'media',
    action: 'Make a media enquiry',
  },
  {
    head: 'Suppliers and contractors',
    body: 'Prequalification and tendering. Tell us the trade and the projects you have delivered.',
    type: 'suppliers',
    action: 'Introduce your firm',
  },
  {
    head: 'Anything else',
    body: 'A general question, careers, or something that fits none of the above. It still reaches a person.',
    type: 'general',
    action: 'Send a general enquiry',
  },
];

export default async function Contact() {
  const settings = await loadContactSettings();
  const hours = hoursText(settings.hours);
  const channels = channelsFor(settings);

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
          standfirst={`One enquiry form, read by a person, answered within one working day. The office line is open ${hours}.`}
        />

        <section className="bg-line py-13 sm:py-16 md:py-20" id="enquiry">
          <div
            className={`${container} reveal-stagger grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-13`}
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
                {channels.map((channel) => (
                  <div key={channel.head} className="flex flex-col gap-1.5 bg-white p-5 sm:p-5.5">
                    <p className="text-[0.656rem] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                      {channel.head}
                    </p>
                    {channel.lines.map((line) => (
                      <p key={line.text} className="flex flex-wrap items-baseline gap-x-2.5 text-[1.0625rem] break-all text-ink">
                        {line.label ? (
                          <span className="text-[0.781rem] break-normal text-zinc-600">{line.label}</span>
                        ) : null}
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

            <ContactForm hours={hours} turnstileSiteKey={turnstileSiteKey()} />
          </div>
        </section>

        <section className={sectionLight}>
          <div
            className={`${container} reveal-stagger grid grid-cols-1 items-start gap-8 md:grid-cols-[1fr_1.25fr] md:gap-14`}
          >
            <div className="flex flex-col gap-5">
              <p className={eyebrow}>The office</p>
              <h2 className={titleMd}>Where to find us</h2>
              <address className="flex flex-col gap-1 text-base leading-[1.8] text-zinc-700 not-italic">
                {settings.addressLines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </address>
              <div className="flex flex-col gap-2">
                <h3 className="text-[0.656rem] font-semibold tracking-[0.18em] text-zinc-600 uppercase">
                  Business hours
                </h3>
                <dl className="flex flex-col text-[0.938rem] text-zinc-700">
                  {settings.hours.map((entry) => (
                    <div
                      key={entry.days}
                      className="flex flex-wrap justify-between gap-x-6 border-b border-line py-2 first:border-t"
                    >
                      <dt>{entry.days}</dt>
                      <dd className="font-mono text-[0.844rem] text-ink">{entry.hours}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <p className={bodyCopy}>
                Visits are by appointment, so that whoever you need is actually in the building.
                Site visits to a development under construction are arranged separately and require
                a safety induction.
              </p>
              {settings.location ? (
                <OfficeMap
                  lat={settings.location.lat}
                  lng={settings.location.lng}
                  label={`CoBuilt office, ${settings.addressLines.slice(0, 2).join(', ')}`}
                />
              ) : null}
            </div>

            <div className="reveal grid grid-cols-1 gap-px border border-zinc-300 bg-zinc-300 sm:grid-cols-2">
              {ROUTES.map((route) => (
                <div key={route.head} className="flex flex-col gap-3 bg-white p-6 sm:p-7.5">
                  <span className={`${glyph} text-orange`} aria-hidden="true">
                    ◈
                  </span>
                  <h3 className={`${cardTitle} tracking-[0.16em]`}>{route.head}</h3>
                  <p className={cardBody}>{route.body}</p>
                  <a
                    className={`${uppercaseLink} mt-auto inline-flex min-h-target items-center self-start pt-1 text-[0.719rem]`}
                    href={`/contact?type=${route.type}#enquiry`}
                  >
                    {route.action} →
                  </a>
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
