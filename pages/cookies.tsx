import ProsePage from '../components/ProsePage';
import { EMAIL } from '../components/site';
import { openPreferences } from '../components/cookieConsent';
import * as prose from '../components/prose';

/**
 * Cookie Policy.
 *
 * The categories here are the ones CookieBanner actually offers, so the two
 * must be changed together.
 */

const CATEGORIES: Array<[string, string, string]> = [
  [
    'Essential',
    'Security, load balancing, and remembering your cookie choice. Always on — the site cannot work without them.',
    'Up to 12 months',
  ],
  [
    'Analytics',
    'Anonymous page-view counts, so we can see which projects draw interest. IP addresses are truncated before storage.',
    '30 days',
  ],
  [
    'Functional',
    'Remembers preferences such as a project filter or a dismissed notice.',
    'Up to 12 months',
  ],
  [
    'Marketing',
    'Measures whether a campaign brought you here. Off unless you switch it on.',
    'Up to 12 months',
  ],
];

export default function Cookies() {
  return (
    <ProsePage
      eyebrow="Legal"
      title="Cookie Policy"
      standfirst="What we store on your device, why, and how to change your mind at any time."
      updated="16 September 2026"
      description="The cookies CoBuilt Investment Partners sets, what each category does, how long it lasts, and how to change your preferences."
    >
      <section className={prose.section}>
        <h2 className={prose.sectionTitle}>Our approach</h2>
        <p className={prose.p}>
          Only essential cookies are enabled by default. Nothing in the analytics, functional or
          marketing categories is loaded until you allow it, and you can withdraw that permission
          at any time without losing access to anything on the site.
        </p>
      </section>

      <section className={prose.section}>
        <h2 className={prose.sectionTitle}>Categories</h2>
        <div className={prose.tableWrap}>
          <table className={prose.table}>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">What it does</th>
                <th scope="col">Lifetime</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map(([name, purpose, life]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td>{purpose}</td>
                  <td>{life}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={prose.section}>
        <h2 className={prose.sectionTitle}>Changing your choice</h2>
        <p className={prose.p}>
          Open the preferences panel and set each category individually. Your choice is stored on
          your device, so you will be asked again on a different browser, or if you clear your
          site data.
        </p>
        <button className={prose.action} type="button" onClick={openPreferences}>
          Change cookie preferences
        </button>
      </section>

      <section className={prose.section}>
        <h2 className={prose.sectionTitle}>Browser controls</h2>
        <p className={prose.p}>
          Your browser can also block or delete cookies for this site, independently of the choice
          you make here. Blocking essential cookies may stop parts of the site working. Browser
          help pages explain the controls for each.
        </p>
      </section>

      <section className={prose.section}>
        <h2 className={prose.sectionTitle}>More information</h2>
        <p className={prose.p}>
          How we handle the data behind these cookies is set out in our{' '}
          <a href="/privacy">Privacy Policy</a>. Questions go to{' '}
          <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
        </p>
      </section>
    </ProsePage>
  );
}
