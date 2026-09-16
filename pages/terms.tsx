import ProsePage from '../components/ProsePage';
import { EMAIL } from '../components/site';
import styles from '../styles/Prose.module.css';

/**
 * Terms & Conditions.
 *
 * The "no offer of investment" section is the one the Corporate Digital
 * Standards brief turns on: the site carries no investment call to action, and
 * this states the same position in binding terms.
 */
export default function Terms() {
  return (
    <ProsePage
      eyebrow="Legal"
      title="Terms & Conditions"
      standfirst="The terms on which CoBuilt Investment Partners makes this website and its contents available to you."
      updated="16 September 2026"
      description="Terms of use for the CoBuilt Investment Partners website, including the position on investment, the status of Project Passport information, and limitations of liability."
    >
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Acceptance</h2>
        <p className={styles.p}>
          By using this website you accept these terms. If you do not accept them, please do not
          use the site. We may revise these terms; the version published here at the time you use
          the site is the one that applies.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>No offer of investment</h2>
        <div className={styles.note}>
          <p className={styles.noteTitle}>Important</p>
          <p className={styles.noteBody}>
            Nothing on this website is an offer to sell, or a solicitation of an offer to buy, any
            security, unit, share or investment product, and nothing here should be read as
            investment, legal, tax or financial advice. CoBuilt Investment Partners does not
            currently offer or solicit investment. An Investor Portal will be introduced only once
            all required regulatory approvals and licences are in place.
          </p>
        </div>
        <p className={styles.p}>
          Registering your interest creates no contract, no allocation and no commitment on either
          side. It records that you would like to receive information. Any future transaction would
          be documented separately, under contract, and you should take independent advice before
          entering into one.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Project and Passport information</h2>
        <p className={styles.p}>
          Project Passport™ records are published in good faith and reflect the position recorded
          at the date each milestone entry was made. Construction programmes move: dates described
          as scheduled are estimates, not commitments, and a published milestone is a record of
          what happened, not a warranty of what will happen next.
        </p>
        <p className={styles.p}>
          Prices, unit mixes, specifications, images and computer-generated visualisations are
          indicative and may change. Images may show a similar development, a show unit, or an
          artist&rsquo;s impression rather than the unit being described. Nothing on this site forms
          part of any contract of sale.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Intellectual property</h2>
        <p className={styles.p}>
          The content of this site — text, photography, layout, graphics and the Project Passport™
          name and mark — belongs to CoBuilt Investment Partners or its licensors. You may read it,
          and print or download extracts for your own non-commercial use. You may not reproduce,
          republish or exploit it commercially without our written permission.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Acceptable use</h2>
        <ul className={styles.list}>
          <li>Do not use the site unlawfully, or to send unsolicited or deceptive messages.</li>
          <li>
            Do not attempt to gain unauthorised access to the site, its servers or any connected
            system, or to probe or scan them.
          </li>
          <li>
            Do not interfere with the site&rsquo;s operation, including by automated scraping that
            places an unreasonable load on it.
          </li>
          <li>Do not submit anything false, misleading, defamatory or infringing.</li>
        </ul>
        <p className={styles.p}>
          We may suspend access where we reasonably believe these terms have been breached.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Third-party links and embeds</h2>
        <p className={styles.p}>
          Where we link to or embed third-party material, we do so for information. We do not
          control those services and are not responsible for their content or their handling of
          your data; their own terms and privacy notices apply.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Availability and liability</h2>
        <p className={styles.p}>
          We aim to keep the site available and its content accurate, but we do not guarantee
          either. The site is provided as it stands. To the extent the law allows, we exclude
          liability for indirect or consequential loss, and for loss of profit, revenue, business or
          anticipated savings, arising from use of this site or reliance on its content.
        </p>
        <p className={styles.p}>
          Nothing in these terms limits liability for death or personal injury caused by
          negligence, for fraud, or for anything else that cannot lawfully be limited.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Governing law</h2>
        <p className={styles.p}>
          These terms are governed by the laws of the Federal Republic of Nigeria, and the courts
          of Nigeria have exclusive jurisdiction over any dispute arising from them.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Contact</h2>
        <p className={styles.p}>
          Questions about these terms go to <a href={`mailto:${EMAIL}`}>{EMAIL}</a>. How we handle
          personal data is set out in our <a href="/privacy">Privacy Policy</a>.
        </p>
      </section>
    </ProsePage>
  );
}
