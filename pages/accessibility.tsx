import ProsePage from '../components/ProsePage';
import { EMAIL, PHONE, PHONE_HREF } from '../components/site';
import styles from '../styles/Prose.module.css';

/**
 * Accessibility Statement.
 *
 * This page is the reason the footer links here rather than asserting "WCAG
 * 2.2 AA" flatly: the claim is partial conformance, and the exceptions below
 * are the honest list. Close one of them and it should come off this page.
 */
export default function Accessibility() {
  return (
    <ProsePage
      eyebrow="Accessibility"
      title="Accessibility Statement"
      standfirst="What this site does to be usable by everyone, what we have verified, and what we know is still outstanding."
      updated="16 September 2026"
      description="CoBuilt Investment Partners' accessibility statement: target conformance with WCAG 2.2 AA, what has been verified, and the known exceptions."
    >
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Our commitment</h2>
        <p className={styles.p}>
          CoBuilt Investment Partners aims to meet the Web Content Accessibility Guidelines
          (WCAG) 2.2 at Level AA across this website. Accessibility is treated as part of
          delivery rather than a retrofit, and this statement is updated as work lands.
        </p>
        <div className={styles.note}>
          <p className={styles.noteTitle}>Conformance status</p>
          <p className={styles.noteBody}>
            <strong>Partially conformant</strong> with WCAG 2.2 Level AA. Most of the standard is
            met; the exceptions listed below are known and are being worked through. The site has
            not yet been through an independent audit or a full assistive-technology test.
          </p>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>What has been verified</h2>
        <ul className={styles.list}>
          <li>
            <strong>Colour contrast.</strong> Every text and interface colour pairing the site
            renders has been measured against the WCAG formula and meets 4.5:1 for body text, 3:1
            for large text and non-text elements. These are checked by an automated test that runs
            on every build, so a regression fails the build rather than reaching the site.
          </li>
          <li>
            <strong>Target size.</strong> Interactive controls are at least 44&nbsp;&times;&nbsp;44
            pixels.
          </li>
          <li>
            <strong>Keyboard access.</strong> All navigation, filters, form fields and the cookie
            controls are reachable and operable by keyboard, with a visible focus indicator that
            keeps 3:1 contrast on both light and dark backgrounds.
          </li>
          <li>
            <strong>Structure.</strong> Pages use landmarks, a single H1 and a correct heading
            order. Form fields have persistent labels, not placeholder-only labels.
          </li>
          <li>
            <strong>Reduced motion.</strong> The scrolling wordmark and all transitions stop for
            visitors whose system requests reduced motion.
          </li>
          <li>
            <strong>Zoom and reflow.</strong> Content reflows to a single column down to 320&nbsp;px
            and remains readable at 200% zoom without horizontal scrolling.
          </li>
          <li>
            <strong>Colour independence.</strong> No information is conveyed by colour alone;
            project stages carry a text label as well as a colour.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Known exceptions</h2>
        <p className={styles.p}>We are aware of the following, and intend to resolve them:</p>
        <ul className={styles.list}>
          <li>
            <strong>Video captions and transcripts.</strong> The video library is not yet live.
            When it is, each film will carry captions and a transcript; until then the section
            shows a still image only.
          </li>
          <li>
            <strong>Independent audit.</strong> Conformance has been verified internally, including
            automated contrast testing, but not yet by an external auditor or through structured
            testing with screen-reader users.
          </li>
          <li>
            <strong>Third-party embeds.</strong> Content served by third parties, such as embedded
            video or mapping, may not fully meet AA. We will raise issues with those providers and
            offer an accessible alternative where we can.
          </li>
          <li>
            <strong>Documents.</strong> PDFs and other downloads published before this statement
            may not be fully tagged for screen readers. Ask us and we will supply an accessible
            version.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Telling us about a problem</h2>
        <p className={styles.p}>
          If something on this site blocks you, we want to know — it is the fastest way for us to
          fix it. Email <a href={`mailto:${EMAIL}`}>{EMAIL}</a> or call{' '}
          <a href={PHONE_HREF}>{PHONE}</a>, Monday to Friday, 08:00–17:00 WAT. Tell us the page and
          what happened, and we will respond within five working days.
        </p>
        <p className={styles.p}>
          If you need information from this site in another format — large print, plain text, or
          read aloud over the phone — ask and we will provide it.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>How this was assessed</h2>
        <p className={styles.p}>
          Self-assessment, carried out by the team building the site, combining automated checks
          run as part of the build with manual keyboard and zoom testing. This statement was
          prepared on 16 September 2026 and is reviewed whenever the site changes materially.
        </p>
      </section>
    </ProsePage>
  );
}
