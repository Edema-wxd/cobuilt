import ProsePage from '../components/ProsePage';
import { EMAIL } from '../components/site';
import * as prose from '../components/prose';

/**
 * Careers.
 *
 * The nine-item navigation the brief mandates includes Careers, so the link
 * needs a destination. There are no vacancies to list yet, so the page says
 * so plainly and routes speculative applications somewhere real, rather than
 * showing invented roles.
 */
export default function Careers() {
  return (
    <ProsePage
      eyebrow="Careers"
      title="Working at CoBuilt"
      standfirst="We build in the open, and we hire people who are comfortable working that way."
      description="Careers at CoBuilt Investment Partners — how we work, the disciplines we hire into, and how to send a speculative application."
      current="/careers"
    >
      <section className={prose.section}>
        <h2 className={prose.sectionTitle}>Current vacancies</h2>
        <div className={prose.note}>
          <p className={prose.noteTitle}>No open roles at present</p>
          <p className={prose.noteBody}>
            We are not advertising a vacancy right now. Open roles will be listed on this page when
            they arise, with the scope, location and closing date for each. Speculative
            applications are welcome in the meantime.
          </p>
        </div>
      </section>

      <section className={prose.section}>
        <h2 className={prose.sectionTitle}>How we work</h2>
        <p className={prose.p}>
          Every CoBuilt development carries a Project Passport™: a dated, public record of each
          milestone, with the site photography, progress reports and certificates attached. That
          commitment shapes the job. Work is documented as it happens, programmes are published
          before they are met, and a slipped date is reported rather than quietly revised.
        </p>
        <p className={prose.p}>
          It suits people who would rather answer a question with a document than an assurance.
        </p>
      </section>

      <section className={prose.section}>
        <h2 className={prose.sectionTitle}>Disciplines we hire into</h2>
        <ul className={prose.list}>
          <li>Development and project management</li>
          <li>Construction management and site supervision</li>
          <li>Quantity surveying and cost control</li>
          <li>Architecture and design coordination</li>
          <li>Sales, client relations and marketing</li>
          <li>Finance, legal and compliance</li>
          <li>Technology and data</li>
        </ul>
      </section>

      <section className={prose.section}>
        <h2 className={prose.sectionTitle}>Sending a speculative application</h2>
        <p className={prose.p}>
          Email <a href={`mailto:${EMAIL}`}>{EMAIL}</a> with &ldquo;Careers&rdquo; in the subject
          line. Include your CV, the discipline you work in, and a short note on a project you
          delivered and what you would do differently next time. We read every application and
          reply either way.
        </p>
        <p className={prose.p}>
          We hold application data for six months and then delete it, unless you ask us to keep it
          longer. Our <a href="/privacy">Privacy Policy</a> explains your rights over that data.
        </p>
      </section>

      <section className={prose.section}>
        <h2 className={prose.sectionTitle}>Equal opportunity</h2>
        <p className={prose.p}>
          CoBuilt Investment Partners recruits on merit. We do not discriminate on the basis of
          gender, ethnicity, religion, age, disability or state of origin, and we will make
          reasonable adjustments at any stage of the process — tell us what you need.
        </p>
      </section>
    </ProsePage>
  );
}
