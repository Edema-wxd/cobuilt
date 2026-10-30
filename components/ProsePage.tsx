import type { ReactNode } from 'react';
import SiteLayout from './SiteLayout';
import * as prose from './prose';
import { eyebrowOnDark } from './ui';

interface Props {
  eyebrow: string;
  title: string;
  standfirst: string;
  /** Human-readable date, e.g. "16 September 2026". Omitted on non-policy pages. */
  updated?: string;
  current?: string;
  children: ReactNode;
}

/**
 * Shared shell for the standalone text pages.
 *
 * `title` is the visible heading only; the document title comes from the
 * page's own `metadata` export.
 */
export default function ProsePage({
  eyebrow,
  title,
  standfirst,
  updated,
  current,
  children,
}: Props) {
  return (
    <SiteLayout {...(current ? { current } : {})}>
      <main>
        <div className={prose.head}>
          <div className={`${prose.headInner} intro`}>
            <p className={eyebrowOnDark}>{eyebrow}</p>
            <h1 className={prose.title}>{title}</h1>
            <p className={prose.standfirst}>{standfirst}</p>
            {updated ? <p className={prose.updated}>Last updated {updated}</p> : null}
          </div>
        </div>

        <div className={prose.body}>
          <div className={prose.prose}>{children}</div>
        </div>
      </main>
    </SiteLayout>
  );
}
