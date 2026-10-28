import { NOTICE_TEXT, noticeOnDark, titleSm } from './sections';
import { btnOrange, btnOutlineOnDark, container, eyebrowOnDark } from './ui';

interface Props {
  eyebrow?: string;
  title: string;
  body: string;
  /**
   * Carries the licensing notice. Set on any page an investor could read as an
   * offer — Passport™, Services, About — per the brief's §1.
   */
  notice?: boolean;
}

/**
 * The closing band on the landing-style pages.
 *
 * Two actions, and neither is an investment call to action: the primary one
 * opens the enquiry form, the secondary one registers interest in updates.
 * That is the furthest any investor-facing path goes until the licences are in
 * place, so this component is the only closing band the new pages use.
 */
export default function CtaBand({ eyebrow = 'Next step', title, body, notice }: Props) {
  return (
    <section className="bg-ink py-13 sm:py-16 md:py-20">
      <div
        className={`${container} reveal-stagger grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.2fr_1fr] lg:gap-13`}
      >
        <div className="flex flex-col gap-4 [&_h2_em]:text-orange-on-dark">
          <p className={eyebrowOnDark}>{eyebrow}</p>
          <h2 className={`${titleSm} text-white`}>{title}</h2>
          <p className="max-w-135 text-[0.969rem] leading-[1.75] text-zinc-200">{body}</p>
          {notice ? <p className={noticeOnDark}>{NOTICE_TEXT}</p> : null}
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap lg:flex-col lg:items-stretch">
          <a className={btnOrange} href="/contact">
            Discuss your project
          </a>
          <a className={btnOutlineOnDark} href="/#register">
            Register your interest
          </a>
        </div>
      </div>
    </section>
  );
}
