import ProsePage from '../components/ProsePage';
import { EMAIL, PHONE, PHONE_HREF } from '../components/site';
import * as prose from '../components/prose';

/**
 * Privacy Policy (NDPA).
 *
 * The retention periods and rights described here mirror what the system
 * actually does — the windows come from RETENTION_* in src/lib/env.ts, the
 * export and erasure routes exist under /api/users/[userId]. If either side
 * changes, both have to change together.
 */

const RETENTION: Array<[string, string, string]> = [
  ['Newsletter and interest registrations', 'Email address, name, the category you selected', 'Until you unsubscribe'],
  ['General enquiries', 'Name, email, phone, your message', '90 days'],
  ['Investor enquiries', 'Name, email, phone, company, your message', '2 years (730 days)'],
  ['Page analytics', 'Page path, referrer, truncated IP, browser type', '30 days'],
  ['Account records', 'Email, name, role, sign-in history', 'While the account is open'],
];

export default function Privacy() {
  return (
    <ProsePage
      eyebrow="Legal"
      title="Privacy Policy"
      standfirst="How CoBuilt Investment Partners collects, uses and retains personal data, and the rights you hold over it under the Nigeria Data Protection Act."
      updated="16 September 2026"
      description="How CoBuilt Investment Partners handles personal data under the Nigeria Data Protection Act — what we collect, why, how long we keep it, and your rights."
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
            taking steps at your request before any contract.
          </li>
          <li>
            <strong>When you browse</strong> — the page visited, where you arrived from, your
            browser type, and a truncated IP address. The final octet of an IPv4 address (or the
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
          Records are deleted automatically once their retention window closes. Nothing is kept
          indefinitely except where law requires it.
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
          contract and each processing only on our instructions: our hosting provider, our
          transactional email provider, and our content and search infrastructure. We do not sell
          personal data or share it with advertisers.
        </p>
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
          Write to <a href={`mailto:${EMAIL}`}>{EMAIL}</a> and we will respond within 30 days. If
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
