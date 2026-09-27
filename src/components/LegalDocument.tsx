import Head from 'next/head';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { COMPANY } from '@/content/company';
import { SiteLayout } from './SiteLayout';
import site from '../../styles/Site.module.css';
import styles from '../../styles/Legal.module.css';

export interface LegalSection {
  id: string;
  title: string;
  content: ReactNode;
}

interface LegalDocumentProps {
  title: string;
  description: string;
  lead: string;
  effective: string;
  summary: string[];
  sections: LegalSection[];
  related: { href: string; label: string };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function LegalDocument(props: LegalDocumentProps) {
  return (
    <SiteLayout>
      <Head>
        <title>{`${props.title} | CoBuilt Investment Partners`}</title>
        <meta name="description" content={props.description} />
      </Head>

      <header className={styles.header}>
        <div className={site.container}>
          <p className={styles.kicker}>Legal</p>
          <h1 className={styles.title}>{props.title}</h1>
          <p className={styles.lead}>{props.lead}</p>
          <dl className={styles.meta}>
            <div className={styles.metaItem}>
              <dt className={styles.metaLabel}>Effective</dt>
              <dd className={styles.metaValue}>{props.effective}</dd>
            </div>
            <div className={styles.metaItem}>
              <dt className={styles.metaLabel}>Applies to</dt>
              <dd className={styles.metaValue}>{COMPANY.website}</dd>
            </div>
            <div className={styles.metaItem}>
              <dt className={styles.metaLabel}>Questions</dt>
              <dd className={styles.metaValue}>
                <a href={`mailto:${COMPANY.contactEmail}`}>{COMPANY.contactEmail}</a>
              </dd>
            </div>
          </dl>
        </div>
      </header>

      <div className={`${site.container} ${styles.body}`}>
        <nav className={styles.toc} aria-label="Contents">
          <p className={styles.tocHead}>Contents</p>
          <ol className={styles.tocList}>
            {props.sections.map((section, index) => (
              <li key={section.id}>
                <a className={styles.tocLink} href={`#${section.id}`}>
                  <span className={styles.tocIndex}>{pad(index + 1)}</span>
                  <span>{section.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className={styles.doc}>
          <aside className={styles.summary} aria-label="Summary">
            <p className={styles.summaryHead}>The short version</p>
            <ul>
              {props.summary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </aside>

          {props.sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              className={styles.section}
              aria-labelledby={`${section.id}-title`}
            >
              <h2 id={`${section.id}-title`} className={styles.sectionTitle}>
                <span className={styles.sectionIndex}>{pad(index + 1)}</span>
                {section.title}
              </h2>
              <div className={styles.prose}>{section.content}</div>
            </section>
          ))}

          <footer className={styles.docFooter}>
            <span>
              {COMPANY.name} · Effective {props.effective}
            </span>
            <Link href={props.related.href}>{props.related.label}</Link>
          </footer>
        </article>
      </div>
    </SiteLayout>
  );
}

export interface RecordEntry {
  title: string;
  fields: Array<[label: string, value: ReactNode]>;
}

export function RecordRegister({ records }: { records: RecordEntry[] }) {
  return (
    <div className={styles.records}>
      {records.map((record) => (
        <div key={record.title} className={styles.record}>
          <p className={styles.recordTitle}>{record.title}</p>
          <dl className={styles.recordFields}>
            {record.fields.map(([label, value]) => (
              <div key={label} className={styles.recordField}>
                <dt className={styles.recordLabel}>{label}</dt>
                <dd className={styles.recordValue}>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

/** Company identity for the "who we are" sections; omits what is unconfirmed. */
export function CompanyIdentity() {
  return (
    <>
      {COMPANY.registrationNumber ? (
        <p>Registration number: {COMPANY.registrationNumber}.</p>
      ) : null}
      {COMPANY.registeredOffice ? <p>Registered office: {COMPANY.registeredOffice}.</p> : null}
    </>
  );
}
