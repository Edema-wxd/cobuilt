import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import ConsoleShell from './console-shell';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s — Admin — CoBuilt' },
  robots: { index: false, follow: false },
};

/**
 * Every console screen renders on the client: the session is a bearer token
 * held in memory, so there is nothing for the server to render with. The shell
 * restores that session and gates the screens beneath it.
 */
export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return <ConsoleShell>{children}</ConsoleShell>;
}
