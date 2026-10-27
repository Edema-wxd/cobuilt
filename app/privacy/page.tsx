import type { Metadata } from 'next';
import ProsePage from '../../components/ProsePage';
import { EMAIL, PHONE, PHONE_HREF } from '../../components/site';
import * as prose from '../../components/prose';

/**
 * Privacy Policy (NDPA).
 *
 * The retention periods and rights described here mirror what the system
 * actually does — the windows come from RETENTION_* in src/lib/env.ts, the
 * export and erasure routes exist under /api/users/[userId] and are offered
 * at /admin/account. If either side changes, both have to change together.
 */

const RETENTION: Array<[string, string, string]> = [
  ['Newsletter and interest registrations', 'Email address, name, the category you selected', 'Until you unsubscribe'],
  ['General enquiries', 'Name, email, phone, your message, IP address and browser details', '90 days, then anonymised'],
  ['Investor enquiries', 'Name, email, phone, company, your message, IP address and browser details', '2 years (730 days), then anonymised'],
  ['Page analytics', 'Page path, referrer, truncated IP, browser type', '30 days, then deleted'],
  ['WhatsApp and live chat', 'Phone number or chat name, email, your messages', '90 days after each message, then deleted'],
  ['Account records', 'Email, name, role, sign-in history', 'While the account is open'],
];

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How CoBuilt Investment Partners handles personal data under the Nigeria Data Protection Act — what we collect, why, how long we keep it, and your rights.',
};

export default function Privacy() {
  return (
    <ProsePage
      eyebrow="Legal"
      title="Privacy Policy"
      standfirst="How CoBuilt Investment Partners collects, uses and retains personal data, and the rights you hold over it under the Nigeria Data Protection Act."
      updated="26 October 2026"
    >
      <section className={prose.section}>
        <h2 className={prose.sectionTitle}>Who we are</h2>
        <p className={prose.p}>
          CoBuilt Investment Partners (&ldquo;CoBuilt&rdquo;, &ldquo;we&rdquo;) is a property
          development company registered in Nigeria, with offices at 27 Apex Drive, TechZone
          District, Victoria Heights, Lagos. For the purposes of the Nigeria Data Protection Act
          2023 (the &ldquo;NDPA&rdquo;) we are the data controller for personal data collected
          through this website.
        </p>
        <p className={prose.p}>
          Questions about this policy, or about how we handle your data, go to{' '}
          <a href={`mailto:${EMAIL}`}>{EMAIL}</a> or <a href={PHONE_HREF}>{PHONE}</a>.
        </p>
      </section>

      <section className={prose.section}>
        <h2 className={prose.sectionTitle}>What we collect, and why</h2>
        <p className={prose.p}>
          We collect only what a specific interaction needs. We do not buy personal data, and we do
          not build advertising profiles.
        </p>
        <ul className={prose.list}>
          <li>
            <strong>When you register your interest</strong> — your name, email address and the
            enquirer category you choose. We use these to send the project and milestone updates
            you asked for. The lawful basis is your consent, confirmed by the link we email you.
          </li>
          <li>
            <strong>When you contact us</strong> — your name, email address, phone number if you
            give one, and the content of your message, so that we can answer it. The lawful basis
            is our legitimate interest in responding to enquiries, and for investor enquiries, in
            taking steps at your request before any contract. The form also records your full IP
            address and browser details, which we use only to detect spam and abuse.
          </li>
          <li>
            <strong>When you message us on WhatsApp or live chat</strong> — your phone number or
            chat name, your email if you give it, the messages you send and their delivery status,
            so that we can reply. The lawful basis is your consent, given by contacting us on that
            channel.
          </li>
          <li>
            <strong>When you browse</strong> — the page visited, where you arrived from (without
            any query string), your browser type, a random identifier for the visit, and a
            truncated IP address. The final octet of an IPv4 address (or the
            last 80 bits of an IPv6 address) is discarded before storage, so the record shows
            coarse geography and never identifies you. The lawful basis is consent where analytics
            cookies are enabled; essential logging rests on legitimate interest.
          </li>
          <li>
            <strong>If you hold an account</strong> — your email, name, role and sign-in history,
            to operate the account and keep it secure.
          </li>
        </ul>
      </section>

      <section className={prose.section}>
        <h2 className={prose.sectionTitle}>How long we keep it</h2>
        <p className={prose.p}>
          Where a period is fixed, a scheduled job enforces it automatically once the window
          closes. Nothing is kept indefinitely except where law requires it.
        </p>
        <p className={prose.p}>
          <strong>Anonymised</strong> means your name, email, phone number, message, IP address and
          browser details are erased from the record. What remains is only the fact that an enquiry
          was received on a given date, which we use to count enquiries over time.
        </p>
        <div className={prose.tableWrap}>
          <table className={prose.table}>
            <thead>
              <tr>
                <th scope="col">Record</th>
                <th scope="col">Data</th>
                <th scope="col">Retention</th>
              </tr>
            </thead>
            <tbody>
              {RETENTION.map(([record, data, period]) => (
                <tr key={record}>
                  <td>{record}</td>
                  <td>{data}</td>
                  <td>{period}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={prose.section}>
        <h2 className={prose.sectionTitle}>Who else sees your data</h2>
        <p className={prose.p}>
          We share personal data only with the service providers needed to run the site, each under
          contract and each processing only on our instructions, and only what each needs. We do
          not sell personal data or share it with advertisers. Those providers are:
        </p>
        <ul className={prose.list}>
          <li>
            <strong>Our hosting, database and file storage providers</strong>, which store the
            records described above.
          </li>
          <li>
            <strong>Cloudflare</strong>, which delivers and protects the website and handles the IP
            address of every visit.
          </li>
          <li>
            <strong>Our email delivery provider</strong>, which sends confirmation emails, replies
            and updates, and handles your email address and the content of those emails.
          </li>
          <li>
            <strong>A spam-filtering service</strong> (Akismet, operated by Automattic Inc.), which
            may receive the name, email, message, IP address and browser details from a form
            submission to judge whether it is spam. A submission marked as spam is kept for a person
            on our team to review, not discarded.
          </li>
          <li>
            <strong>An error-monitoring service</strong>, which receives technical details when
            something on the site fails, such as the error and the page address. It is not sent
            form contents, cookies or IP addresses.
          </li>
          <li>
            <strong>Google Fonts</strong>, which supplies the typefaces on this site. Your browser
            requests them from Google, which receives your IP address and browser details.
          </li>
          <li>
            <strong>Meta</strong>, if you contact us on WhatsApp. Meta&rsquo;s own privacy policy
            also applies to that conversation.
          </li>
        </ul>
        <p className={prose.p}>
          Some of these providers operate outside Nigeria. Where personal data is transferred
          abroad, we rely on the adequacy and contractual safeguards the NDPA permits.
        </p>
        <p className={prose.p}>
          We may disclose data where the law requires it, or to establish or defend a legal claim.
        </p>
      </section>

      <section className={prose.section}>
        <h2 className={prose.sectionTitle}>Your rights</h2>
        <p className={prose.p}>Under the NDPA you may ask us to:</p>
        <ul className={prose.list}>
          <li>Confirm what personal data we hold about you, and give you a copy of it.</li>
          <li>Correct anything inaccurate or incomplete.</li>
          <li>Delete your data, where we have no overriding obligation to keep it.</li>
          <li>Restrict or object to a particular use.</li>
          <li>Provide your data in a portable, machine-readable form.</li>
          <li>
            Withdraw consent at any time — every email we send carries an unsubscribe link, and
            withdrawing does not affect processing carried out beforehand.
          </li>
        </ul>
        <p className={prose.p}>
          If you hold an account, you can exercise two of these yourself, at any time: download a
          machine-readable copy of your data, and delete your account, from{' '}
          <a href="/admin/account">your account page</a>.
        </p>
        <p className={prose.p}>
          For anything else, write to <a href={`mailto:${EMAIL}`}>{EMAIL}</a> and we will respond
          within 30 days. If
          you are not satisfied with our response, you may complain to the Nigeria Data Protection
          Commission.
        </p>
      </section>

      <section className={prose.section}>
        <h2 className={prose.sectionTitle}>Security</h2>
        <p className={prose.p}>
          Data is transmitted over TLS and stored on access-controlled infrastructure. Passwords
          are hashed, never stored in readable form. Administrative access is limited by role and
          recorded in an audit log. Contact details shown to staff in internal tools are masked by
          default.
        </p>
        <p className={prose.p}>
          No system is perfectly secure. If a breach affects your personal data, we will notify the
          Nigeria Data Protection Commission within 72 hours of becoming aware of it, and tell you
          without delay where the breach is likely to put your rights at high risk.
        </p>
      </section>

      <section className={prose.section}>
        <h2 className={prose.sectionTitle}>Children</h2>
        <p className={prose.p}>
          This site is intended for adults. We do not knowingly collect personal data from anyone
          under 18. If you believe a child has sent us their details, contact us and we will delete
          them.
        </p>
      </section>

      <section className={prose.section}>
        <h2 className={prose.sectionTitle}>Cookies</h2>
        <p className={prose.p}>
          Only essential cookies are set unless you allow more. Categories, purposes and durations
          are set out in the <a href="/cookies">Cookie Policy</a>, where you can also change your
          choice at any time.
        </p>
      </section>

      <section className={prose.section}>
        <h2 className={prose.sectionTitle}>Changes to this policy</h2>
        <p className={prose.p}>
          If we change how we handle personal data we will update this page and revise the date
          above. Where a change materially affects you, we will say so directly.
        </p>
      </section>
    </ProsePage>
  );
}