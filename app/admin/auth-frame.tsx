import type { ReactNode } from 'react';
import { eyebrow } from '../../components/ui';

/**
 * The signed-out pages — sign in, register, forgot and reset password — share
 * one frame: the wordmark over a single white card on the console's grey.
 */

/** Charcoal, not white: white on #FF6600 is 2.94:1. */
export const submitButton =
  'inline-flex min-h-12.5 w-full cursor-pointer items-center justify-center border border-transparent bg-orange px-7 text-[0.719rem] font-semibold tracking-[0.16em] text-ink uppercase transition-colors duration-150 enabled:hover:bg-orange-lift disabled:cursor-not-allowed disabled:opacity-60';

export const card = 'flex flex-col gap-5 border border-zinc-300 bg-white p-6 sm:p-8';
export const lead = 'text-[0.938rem] leading-[1.7] text-zinc-600';
export const hint = 'text-[0.781rem] leading-[1.6] text-zinc-600';
export const link = 'text-rust underline hover:text-rust-hover';
export const errorText = 'text-[0.781rem] font-medium text-msg-bad';
export const okText = 'text-[0.781rem] font-medium text-msg-ok';

export function AuthFrame({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-100 px-gutter py-12">
      <div className="flex w-full max-w-md flex-col gap-6">
        <a className="self-start text-[0.938rem] font-semibold tracking-[-0.01em] text-ink" href="/">
          CoBuilt<span className="text-rust">.</span>
        </a>
        {children}
        {footer ? <p className="text-[0.813rem] text-zinc-600">{footer}</p> : null}
      </div>
    </main>
  );
}

export function CardHead({ label, title }: { label: string; title: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className={eyebrow}>{label}</p>
      <h1 className="text-[1.75rem] text-ink">{title}</h1>
    </div>
  );
}
