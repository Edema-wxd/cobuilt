import type { Metadata } from 'next';
import SignInForm from './sign-in-form';

export const metadata: Metadata = {
  title: 'Admin sign in',
  robots: { index: false, follow: false },
};

/** The console's front door. Public accounts (Phase 2) will get their own. */
export default function SignInPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-100 px-gutter py-12">
      <div className="flex w-full max-w-md flex-col gap-6">
        <a className="self-start text-[0.938rem] font-semibold tracking-[-0.01em] text-ink" href="/">
          CoBuilt<span className="text-rust">.</span>
        </a>
        <SignInForm />
      </div>
    </main>
  );
}
