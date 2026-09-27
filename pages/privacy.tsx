import Link from 'next/link';
import { COMPANY } from '@/content/company';
import {
  CompanyIdentity,
  LegalDocument,
  RecordRegister,
  type LegalSection,
} from '@/components/LegalDocument';

/**
 * Every retention period and data field below mirrors what the backend stores
 * (src/lib/repositories, db/migrations, .env.example RETENTION_*). Change the
 * code and this page together.
 */

const email = <a href={`mailto:${COMPANY.contactEmail}`}>{COMPANY.contactEmail}</a>;

const sections: LegalSection[] = [
  {
    id: 'who-we-are',
    title: 'Who we are',
    content: (
      <>
        <p>
          {COMPANY.name} (&quot;CoBuilt&quot;, &quot;we&quot;, &quot;us&quot;) develops and manages
          property in Nigeria. We are the data controller for personal data collected through{' '}
          {COMPANY.website}, the forms on it, our milestone update emails and our WhatsApp and live
          chat channels.
        </p>
        <CompanyIdentity />
        <p>
          We process personal data under the Nigeria Data Protection Act 2023 (the
          &quot;NDPA&quot;). For anything in this policy, or to use any of your rights, write to{' '}
          {email}.
        </p>
      </>
    ),
  },
  {
    id: 'what-we-collect',
    title: 'What we collect, why, and for how long',
    content: (
      <>
        <p>
          We collect only what each part of the site needs. Each record below says how long we
          keep it. Where the period is fixed, a nightly job enforces it: when the period ends, the
          personal details are removed automatically.
        </p>
        <RecordRegister
          records={[
            {
              title: 'Contact enquiries',
              fields: [
                [
                  'What',
                  'Name, email, phone (optional), subject, message, the project you asked about, and when you gave consent. Also your IP address and browser details.',
                ],
                [
                  'Why',
                  'To answer you. The IP address and browser details are used only to detect spam and abuse.',
                ],
                ['Basis', 'Your consent, given on the form.'],
                ['Kept', '90 days, then anonymised.'],
              ],
            },
            {
              title: 'Investment enquiries',
              fields: [
                [
                  'What',
                  'Name, email, phone (optional), company, indicative investment range, the project you asked about, message and when you gave consent. Also your IP address and browser details.',
                ],
                ['Why', 'To respond to you and route your enquiry to our legal team for review.'],
                [
                  'Basis',
                  'Your consent, and steps you ask us to take before entering into a contract.',
                ],
                ['Kept', 'Two years, then anonymised.'],
              ],
            },
            {
              title: 'Milestone updates',
              fields: [
                [
                  'What',
                  'Email address, name (optional), where you signed up, your IP address at sign-up, and when you confirmed.',
                ],
                ['Why', 'To email you when a project stage is completed.'],
                [
                  'Basis',
                  'Your consent, confirmed by clicking the link we send. Nothing is sent before you click it.',
                ],
                [
                  'Kept',
                  'Until you unsubscribe. After that we keep only your address and the date you left, so we never email you again. Ask us and we delete it entirely.',
                ],
              ],
            },
            {
              title: 'Site visits',
              fields: [
                [
                  'What',
                  'The page viewed, the page that linked to it, your browser details, a random identifier for the visit, and your IP address with its final part removed before it is stored.',
                ],
                ['Why', 'To see which pages are read and how the site is performing.'],
                ['Basis', 'Our legitimate interest in running a usable website.'],
                ['Kept', '30 days, then deleted.'],
              ],
            },
            {
              title: 'WhatsApp and live chat',
              fields: [
                [
                  'What',
                  'Your phone number or chat name and email, the messages you send, and their delivery status.',
                ],
                ['Why', 'To reply to you.'],
                ['Basis', 'Your consent, by contacting us on that channel.'],
                ['Kept', 'For as long as we need it to deal with your conversation.'],
              ],
            },
            {
              title: 'Staff and invited accounts',
              fields: [
                [
                  'What',
                  'Name, email, role, a one-way hash of your password, sign-in times, the IP address and browser of each session, and a log of actions taken in the admin area.',
                ],
                ['Why', 'To keep the admin area secure and to show who changed what.'],
                [
                  'Basis',
                  'The arrangement under which you were given the account, and our legitimate interest in accountability.',
                ],
                [
                  'Kept',
                  'While the account is open. Session records are deleted 30 days after they expire. The action log is kept as an accountability record.',
                ],
              ],
            },
          ]}
        />
        <p>
          <strong>Anonymised</strong> means your name, email, phone number, message, IP address and
          browser details are erased from the record. What remains is only the fact that an enquiry
          was received on a given date, which we use to count enquiries over time.
        </p>
      </>
    ),
  },
  {
    id: 'what-we-do-not-do',
    title: 'What we do not do',
    content: (
      <ul>
        <li>We do not sell or rent personal data to anyone.</li>
        <li>We do not use advertising, retargeting or cross-site tracking.</li>
        <li>We do not build profiles of individual visitors.</li>
        <li>
          We do not make decisions about you by automated means alone. Submissions are checked
          automatically for spam, but a submission marked as spam is kept for a person on our team
          to review, not discarded.
        </li>
      </ul>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies',
    content: (
      <>
        <p>
          We set no cookies for visitors to the public site. You will not see a cookie banner
          because there is nothing to consent to.
        </p>
        <p>
          People who sign in to the admin area receive two cookies that are strictly necessary for
          that purpose and are never used for tracking:
        </p>
        <ul>
          <li>
            <code>cobuilt_refresh</code> keeps you signed in. It cannot be read by page scripts and
            lasts up to seven days.
          </li>
          <li>
            <code>cobuilt_csrf</code> protects your session against forged requests from other
            websites. It lasts up to seven days.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'sharing',
    title: 'Who we share it with',
    content: (
      <>
        <p>
          Our databases and file storage are hosted in Nigeria. We share personal data only with the
          service providers below, and only what each needs to do its job for us:
        </p>
        <ul>
          <li>
            <strong>Cloudflare</strong>, which delivers and protects the website. It handles the IP
            address of every visit.
          </li>
          <li>
            <strong>Our email delivery provider</strong>, which sends confirmation emails, enquiry
            replies and milestone updates. It handles your email address and the content of those
            emails.
          </li>
          <li>
            <strong>A spam-filtering service</strong> (such as Akismet, operated by Automattic
            Inc.), which may receive the name, email, message, IP address and browser details from a
            form submission to judge whether it is spam.
          </li>
          <li>
            <strong>An error-monitoring service</strong>, which receives technical details when
            something on the site fails. These can include an IP address.
          </li>
          <li>
            <strong>Google Fonts</strong>, which supplies the typefaces on this site. Your browser
            requests them from Google, which receives your IP address and browser details.
          </li>
          <li>
            <strong>Meta</strong>, if you contact us on WhatsApp. Meta&apos;s own privacy policy
            also applies to that conversation.
          </li>
        </ul>
        <p>
          We may also disclose personal data to our professional advisers, to a regulator or law
          enforcement agency where the law requires it, or to a buyer if our business is sold, in
          which case this policy continues to apply to your data.
        </p>
      </>
    ),
  },
  {
    id: 'transfers',
    title: 'Transfers outside Nigeria',
    content: (
      <p>
        Some of the providers above process data outside Nigeria. We transfer personal data abroad
        only where the NDPA permits it: where the destination offers an adequate level of
        protection, where appropriate safeguards such as contractual commitments are in place, or
        where another ground in the NDPA applies. You can ask us for details of the safeguards for
        any transfer.
      </p>
    ),
  },
  {
    id: 'security',
    title: 'How we protect it',
    content: (
      <>
        <ul>
          <li>Every connection to the site is encrypted in transit.</li>
          <li>
            Passwords are stored only as one-way hashes. Password reset and email confirmation links
            work once, and are stored in a form that cannot be turned back into the link.
          </li>
          <li>
            Staff access is limited by role. Contact details are masked in list views, and each time
            a staff member opens a full enquiry, that access is logged.
          </li>
          <li>Forms are rate-limited to slow down automated abuse.</li>
        </ul>
        <p>
          No system is perfectly secure. If a breach affects your personal data, we will notify the
          Nigeria Data Protection Commission within 72 hours of becoming aware of it, and tell you
          without delay where the breach is likely to put your rights at high risk.
        </p>
      </>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your rights',
    content: (
      <>
        <p>Under the NDPA you have the right to:</p>
        <ul>
          <li>know how your personal data is used, which is what this policy is for;</li>
          <li>receive a copy of the personal data we hold about you;</li>
          <li>have inaccurate data corrected;</li>
          <li>have your data erased;</li>
          <li>restrict or object to how we use it, including for direct marketing;</li>
          <li>receive your data in a structured, machine-readable format;</li>
          <li>
            withdraw your consent at any time. This does not affect anything we did before you
            withdrew it;
          </li>
          <li>not be subject to a decision based solely on automated processing.</li>
        </ul>
        <h3>How to use them</h3>
        <p>
          Email {email} from the address the request concerns. If you write from a different
          address, we may ask you to confirm your identity before acting. We do not charge for
          requests, and we respond within 30 days.
        </p>
        <p>
          To stop milestone updates, use the unsubscribe link in any update email. It works
          immediately and does not require you to contact us.
        </p>
        <h3>Complaints</h3>
        <p>
          If you are unhappy with how we have handled your data, please tell us first so we can put
          it right. You also have the right to complain to the Nigeria Data Protection Commission
          (NDPC).
        </p>
      </>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    content: (
      <p>
        This site is intended for adults. We do not knowingly collect personal data from anyone
        under 18. If you believe a child has sent us their details, contact us and we will delete
        them.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    content: (
      <p>
        When we change this policy we update the effective date at the top of the page. If a change
        affects how we use data you have already given us, we will tell you by email before it takes
        effect, where we have your address.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    content: (
      <>
        <p>Questions about this policy or your personal data: {email}.</p>
        <p>
          How you may use this website is set out in our <Link href="/terms">terms of service</Link>
          .
        </p>
      </>
    ),
  },
];

export default function PrivacyPolicy() {
  return (
    <LegalDocument
      title="Privacy policy"
      description="How CoBuilt Investment Partners collects, uses, protects and deletes personal data under the Nigeria Data Protection Act 2023."
      lead="What we collect through this website, why we collect it, how long we keep it, and how you can see, correct or erase it."
      effective="27 September 2026"
      summary={[
        'We collect only what you send us through a form, plus basic technical data needed to run and protect the site.',
        'Enquiries are anonymised after 90 days, investment enquiries after two years, and visit records are deleted after 30 days.',
        'We do not sell data, run advertising trackers or set cookies for public visitors.',
        `You can ask for a copy of your data, or for it to be erased, at any time by emailing ${COMPANY.contactEmail}.`,
      ]}
      sections={sections}
      related={{ href: '/terms', label: 'Terms of service' }}
    />
  );
}
