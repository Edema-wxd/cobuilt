import { ADDRESS_LINES, FOOTER_COLUMNS } from './site';
import { openPreferences } from './cookieConsent';
import { container } from './ui';

/** On a phone each footer link is a full 44px row; the column gap is their height. */
const footerLink =
  'inline-flex min-h-target items-center text-left text-[0.844rem] text-zinc-200 sm:block sm:min-h-0';
const footerLinkLive = `${footerLink} cursor-pointer hover:text-white hover:underline`;
const legalLink = 'text-zinc-400 underline hover:text-white';

export default function SiteFooter() {
  return (
    <>
      <footer className="bg-ink pt-13 pb-7 sm:pt-18 sm:pb-10">
        <div
          className={`${container} grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-4 sm:gap-x-6 sm:gap-y-8 md:grid-cols-[1.4fr_1fr_1fr_1fr_1.1fr] md:gap-8.5`}
        >
          <div className="col-span-full flex flex-col gap-4 md:col-span-1">
            <img
              className="block h-8 w-auto self-start"
              src="/images/cobuilt-logo-dark.webp"
              alt="CoBuilt Investment Partners"
              width={95}
              height={32}
            />
            <p className="text-[0.844rem] leading-[1.8] text-zinc-200">
              {ADDRESS_LINES.map((line, index) => (
                <span key={line}>
                  {line}
                  {index < ADDRESS_LINES.length - 1 ? <br /> : null}
                </span>
              ))}
            </p>
            <p className="text-[0.719rem] font-semibold uppercase tracking-[0.14em] text-orange-on-dark">
              Chat on WhatsApp Business
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.head} className="flex flex-col sm:gap-3">
              <p className="mb-1 text-[0.656rem] font-semibold uppercase tracking-[0.2em] text-orange-on-dark sm:mb-0">
                {column.head}
              </p>
              {column.items.map((item) => {
                if (item.action === 'cookie-preferences') {
                  return (
                    <button
                      key={item.label}
                      className={footerLinkLive}
                      type="button"
                      onClick={openPreferences}
                    >
                      {item.label}
                    </button>
                  );
                }
                return item.href ? (
                  <a key={item.label} className={footerLinkLive} href={item.href}>
                    {item.label}
                  </a>
                ) : (
                  // No page behind this entry yet, so it is not a link.
                  <span key={item.label} className={footerLink}>
                    {item.label}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </footer>

      <div className="bg-ink-deep">
        <div
          className={`${container} flex flex-col items-start gap-2 pt-4.5 pb-[calc(18px+env(safe-area-inset-bottom,0px))] text-[0.719rem] text-zinc-400 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:py-4.5`}
        >
          <span>© 2026 CoBuilt Investment Partners. All rights reserved.</span>
          {/*
            Links rather than a flat assertion. The pages behind them state the
            actual conformance level and the known exceptions, which a badge
            alone would overstate.
          */}
          <span className="uppercase tracking-[0.14em]">
            <a className={legalLink} href="/accessibility">
              WCAG 2.2 AA
            </a>
            {' · '}
            <a className={legalLink} href="/privacy">
              NDPA
            </a>
          </span>
        </div>
      </div>
    </>
  );
}
