'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { Permission } from '@/lib/auth/rbac';
import { loadSession, onSessionEnded, signOut, type Session } from '../auth-client';
import { muted } from '../kit';

/**
 * The console frame: session restore, the permission-filtered navigation and
 * the sign-out control.
 *
 * Hiding a section here is a courtesy, not the control — every endpoint
 * enforces its own role and permission, and a screen reached by URL without
 * them shows the API's 403.
 */

interface NavEntry {
  label: string;
  href: string;
  /** Shown when the user holds any one of these. */
  needs: readonly Permission[];
}

const NAV: NavEntry[] = [
  { label: 'Overview', href: '/admin', needs: [] },
  { label: 'Submissions', href: '/admin/submissions', needs: ['forms:read'] },
  { label: 'Projects', href: '/admin/projects', needs: ['projects:approve_investor_content'] },
  { label: '3D tours', href: '/admin/tours', needs: ['tours:write'] },
  { label: 'Users', href: '/admin/users', needs: ['users:read'] },
  { label: 'Audit log', href: '/admin/audit', needs: ['audit:read'] },
];

/** The permissions that open some part of the console. An investor holds none. */
const CONSOLE_PERMISSIONS = new Set(NAV.flatMap((entry) => entry.needs).concat('analytics:read'));

interface SessionValue extends Session {
  can: (permission: Permission) => boolean;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside the console shell');
  return value;
}

export default function ConsoleShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  // Typed nullable for the Pages Router; under the App Router it is always set.
  const pathname = usePathname() ?? '/admin';
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let current = true;
    const toSignIn = () => router.replace(`/admin/sign-in?next=${encodeURIComponent(pathname)}`);

    void loadSession().then((restored) => {
      if (!current) return;
      if (!restored) {
        toSignIn();
        return;
      }
      setSession(restored);
      setChecked(true);
    });

    const unsubscribe = onSessionEnded(toSignIn);
    return () => {
      current = false;
      unsubscribe();
    };
    // The session is restored once per visit to the console, not per screen,
    // so the path this effect closes over is the one the visit began on.
  }, []);

  if (!checked || !session) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-zinc-100">
        <p className={muted} role="status">
          Checking your session…
        </p>
      </main>
    );
  }

  const can = (permission: Permission) => session.permissions.has(permission);
  const hasAccess = [...session.permissions].some((p) => CONSOLE_PERMISSIONS.has(p));
  const entries = NAV.filter((entry) => entry.needs.length === 0 || entry.needs.some(can));

  async function leave(): Promise<void> {
    await signOut();
    router.replace('/admin/sign-in');
  }

  return (
    <SessionContext.Provider value={{ ...session, can }}>
      <div className="flex min-h-dvh flex-col bg-zinc-100 md:flex-row">
        <aside className="flex flex-col gap-5 bg-ink px-gutter py-5 text-white md:sticky md:top-0 md:h-dvh md:w-60 md:flex-none md:px-6 md:py-8">
          <div className="flex items-center justify-between gap-4 md:flex-col md:items-start">
            <Link className="text-[0.938rem] font-semibold tracking-[-0.01em]" href="/admin">
              CoBuilt<span className="text-orange-on-dark">.</span>{' '}
              <span className="font-normal text-zinc-400">Admin</span>
            </Link>
          </div>

          <nav aria-label="Console">
            <ul className="flex flex-wrap gap-x-1 gap-y-1 md:flex-col">
              {hasAccess
                ? entries.map((entry) => {
                    const active =
                      entry.href === '/admin'
                        ? pathname === '/admin'
                        : pathname.startsWith(entry.href);
                    return (
                      <li key={entry.href}>
                        <Link
                          className={`flex min-h-target items-center border-l-3 px-3 text-[0.813rem] transition-colors duration-150 ${
                            active
                              ? 'border-orange bg-ink-mid font-semibold text-white'
                              : 'border-transparent text-zinc-300 hover:bg-ink-mid hover:text-white'
                          }`}
                          href={entry.href}
                          aria-current={active ? 'page' : undefined}
                        >
                          {entry.label}
                        </Link>
                      </li>
                    );
                  })
                : null}
            </ul>
          </nav>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-on-dark pt-4 md:mt-auto md:flex-col md:items-start">
            <div className="min-w-0">
              <p className="truncate text-[0.813rem] text-white">{session.user.fullName}</p>
              <p className="text-[0.719rem] tracking-[0.12em] text-zinc-400 uppercase">
                {session.user.role}
              </p>
            </div>
            <button
              className="inline-flex min-h-target cursor-pointer items-center border border-line-on-dark px-4 text-[0.688rem] font-semibold tracking-[0.14em] text-white uppercase transition-colors duration-150 hover:bg-white hover:text-ink"
              type="button"
              onClick={() => {
                void leave();
              }}
            >
              Sign out
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-gutter py-8 md:px-10 md:py-10">
          {hasAccess ? (
            children
          ) : (
            <div className="max-w-xl border border-zinc-300 bg-white p-6">
              <h1 className="text-[1.5rem] text-ink">No console access</h1>
              <p className="mt-3 text-[0.938rem] leading-[1.7] text-zinc-600">
                Your account ({session.user.email}) is signed in, but its role carries no admin
                permissions. Ask an administrator if you need access.
              </p>
            </div>
          )}
        </main>
      </div>
    </SessionContext.Provider>
  );
}
