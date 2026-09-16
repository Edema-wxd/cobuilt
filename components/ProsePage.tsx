import type { ReactNode } from 'react';
import SiteLayout from './SiteLayout';
import styles from '../styles/Prose.module.css';

interface Props {
  eyebrow: string;
  title: string;
  standfirst: string;
  /** Human-readable date, e.g. "16 September 2026". Omitted on non-policy pages. */
  updated?: string;
  description: string;
  current?: string;
  children: ReactNode;
}

/** Shared shell for the standalone text pages. */
export default function ProsePage({
  eyebrow,
  title,
  standfirst,
  updated,
  description,
  current,
  children,
}: Props) {
  return (
    <SiteLayout
      title={`${title} — CoBuilt Investment Partners`}
      description={description}
      {...(current ? { current } : {})}
    >
      <main>
        <div className={styles.head}>
          <div className={styles.headInner}>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.standfirst}>{standfirst}</p>
            {updated ? <p className={styles.updated}>Last updated {updated}</p> : null}
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.prose}>{children}</div>
        </div>
      </main>
    </SiteLayout>
  );
}
