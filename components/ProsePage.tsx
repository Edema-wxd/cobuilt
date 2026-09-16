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
        <div className={prose.head}>
          <div className={prose.headInner}>
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
