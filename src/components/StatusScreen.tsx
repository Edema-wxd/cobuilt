import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { SiteLayout } from './SiteLayout';
import site from '../../styles/Site.module.css';
import styles from '../../styles/Status.module.css';

interface StatusScreenProps {
  code: string;
  cardLabel: string;
  kicker: string;
  title: string;
  lead: string;
  stamp: [top: string, middle: string, bottom: string];
  rows: Array<[label: string, value: string]>;
  mrz: [string, string];
  actions: ReactNode;
}

function StatusScreen(props: StatusScreenProps) {
  return (
    <SiteLayout>
      <Head>
        <title>{`${props.title} | CoBuilt Investment Partners`}</title>
        <meta name="robots" content="noindex" />
      </Head>

      <section className={styles.screen}>
        <div className={`${site.container} ${styles.inner}`}>
          <div>
            <p className={styles.kicker}>{props.kicker}</p>
            <h1 className={styles.title}>{props.title}</h1>
            <p className={styles.lead}>{props.lead}</p>
            <div className={styles.actions}>{props.actions}</div>
            <nav className={styles.links} aria-label="Popular pages">
              <Link href="/#passport">Project Passport</Link>
              <Link href="/#projects">Projects</Link>
              <Link href="/#investors">Investors</Link>
              <Link href="/privacy">Privacy</Link>
            </nav>
          </div>

          <article className={styles.card} aria-label={props.cardLabel}>
            <div className={styles.cardHead}>
              <span>{props.cardLabel}</span>
              <span>NGA · CB</span>
            </div>
            <div className={styles.cardBody}>
              <p className={styles.code} aria-hidden="true">
                {props.code}
              </p>
              <dl className={styles.rows}>
                {props.rows.map(([label, value]) => (
                  <div key={label} className={styles.row}>
                    <dt className={styles.rowLabel}>{label}</dt>
                    <dd className={styles.rowValue}>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className={styles.stamp} aria-hidden="true">
              <span className={styles.stampSmall}>{props.stamp[0]}</span>
              <span className={styles.stampLarge}>{props.stamp[1]}</span>
              <span className={styles.stampSmall}>{props.stamp[2]}</span>
            </div>
            <p className={styles.mrz} aria-hidden="true">
              {props.mrz[0]}
              <br />
              {props.mrz[1]}
            </p>
          </article>
        </div>
      </section>
    </SiteLayout>
  );
}

export function NotFoundScreen() {
  // The 404 page is prerendered, so the requested path is only known in the
  // browser; reading it during render would mismatch on hydration.
  const [path, setPath] = useState<string | null>(null);
  useEffect(() => {
    setPath(window.location.pathname);
  }, []);

  return (
    <StatusScreen
      code="404"
      cardLabel="Register search"
      kicker="Error 404 · Page not found"
      title="There is no record of this page."
      lead="The link may be out of date, or the address may contain a typo. Everything else on the site is where it should be."
      stamp={['Search', 'No record', 'Returned']}
      rows={[
        ['Requested', path ?? '...'],
        ['Result', 'No matching page'],
        ['Next step', 'Start from the homepage'],
      ]}
      mrz={[
        'P<NGACOBUILT<<NO<RECORD<<<<<<<<<<<<<<<<<<',
        'CB4040000NGA<<<<<<<<<<<<<<<<<<<<<<<<<<<<0',
      ]}
      actions={
        <>
          <Link className={site.btnPrimary} href="/">
            Back to the homepage
          </Link>
          <Link className={site.btnGhost} href="/#projects">
            Browse projects
          </Link>
        </>
      }
    />
  );
}

interface ErrorCopy {
  title: string;
  lead: string;
  status: string;
}

function errorCopy(statusCode: number | undefined): ErrorCopy {
  if (statusCode === undefined) {
    return {
      title: 'This page stopped working.',
      lead: 'Something went wrong while the page was running in your browser. Reloading usually fixes it. If it does not, try again later.',
      status: 'Interrupted in browser',
    };
  }
  if (statusCode === 403) {
    return {
      title: 'This page is not open to the public.',
      lead: 'You do not have access to the page you asked for. If you were sent a link, check with the person who shared it.',
      status: 'Access refused',
    };
  }
  if (statusCode >= 400 && statusCode < 500) {
    return {
      title: 'That request could not be completed.',
      lead: 'The address or the request was not in a form we could handle. Go back and try again, or start from the homepage.',
      status: 'Request refused',
    };
  }
  if (statusCode === 502 || statusCode === 503 || statusCode === 504) {
    return {
      title: 'The site is briefly unavailable.',
      lead: 'We are unable to serve this page for a moment, usually during maintenance. Nothing you did caused this. Try again in a few minutes.',
      status: 'Temporarily unavailable',
    };
  }
  return {
    title: 'Something failed on our side.',
    lead: 'The page could not be loaded. Nothing you did caused this. Try again in a moment.',
    status: 'Interrupted',
  };
}

export function ErrorScreen({ statusCode }: { statusCode?: number }) {
  const copy = errorCopy(statusCode);
  const code = statusCode === undefined ? 'Error' : String(statusCode);

  return (
    <StatusScreen
      code={code}
      cardLabel="Service record"
      kicker={statusCode === undefined ? 'Unexpected error' : `Error ${statusCode}`}
      title={copy.title}
      lead={copy.lead}
      stamp={['Service', 'Retry', 'Advised']}
      rows={[
        ['Status', copy.status],
        ['Result', 'Page not delivered'],
        ['Next step', 'Reload, or start again'],
      ]}
      mrz={[
        'P<NGACOBUILT<<SERVICE<RECORD<<<<<<<<<<<<<',
        `CB${code.toUpperCase()}0000NGA<<<<<<<<<<<<<<<<<<<<<<<<<<0`,
      ]}
      actions={
        <>
          <button
            className={site.btnPrimary}
            type="button"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
          <Link className={site.btnGhost} href="/">
            Back to the homepage
          </Link>
        </>
      }
    />
  );
}
