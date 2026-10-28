import BrickMark from './BrickMark';
import SiteHeader from './SiteHeader';
import { container } from './ui';

interface Props {
  /** Read to assistive technology while the page streams in. */
  label?: string;
  /** Nav item to mark current, as the page that replaces this one will. */
  current?: string;
}

/**
 * Route-level loading state for the pages that wait on the database. The
 * site header is already in place and a charcoal band holds the place of the
 * page header, so nothing jumps when the page arrives; the brick mark lays
 * itself while it waits.
 */
export default function PageLoading({ label = 'Loading', current }: Props) {
  return (
    <>
      <SiteHeader {...(current ? { current } : {})} />
      <main role="status" aria-live="polite">
        <div className="bg-ink">
          <div
            className={`${container} flex min-h-[60vh] flex-col items-center justify-center gap-5`}
          >
            <BrickMark className="loading-mark w-20" />
            <p className="text-[0.688rem] font-medium uppercase tracking-[0.28em] text-zinc-400">
              {label}
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
