import styles from '../styles/Chrome.module.css';
import { ADDRESS_LINES, FOOTER_COLUMNS } from './site';
import { openPreferences } from './cookieConsent';

export default function SiteFooter() {
  return (
    <>
      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerGrid}`}>
          <div className={styles.footerBrand}>
            <img
              className={styles.footerLogo}
              src="/images/cobuilt-logo-dark.webp"
              alt="CoBuilt Investment Partners"
              width={95}
              height={32}
            />
            <p className={styles.footerAddress}>
              {ADDRESS_LINES.map((line, index) => (
                <span key={line}>
                  {line}
                  {index < ADDRESS_LINES.length - 1 ? <br /> : null}
                </span>
              ))}
            </p>
            <p className={styles.footerWhatsapp}>Chat on WhatsApp Business</p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.head} className={styles.footerCol}>
              <p className={styles.footerHead}>{column.head}</p>
              {column.items.map((item) => {
                if (item.action === 'cookie-preferences') {
                  return (
                    <button
                      key={item.label}
                      className={styles.footerLink}
                      type="button"
                      onClick={openPreferences}
                    >
                      {item.label}
                    </button>
                  );
                }
                return item.href ? (
                  <a key={item.label} className={styles.footerLink} href={item.href}>
                    {item.label}
                  </a>
                ) : (
                  // No page behind this entry yet, so it is not a link.
                  <span key={item.label} className={styles.footerLink}>
                    {item.label}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </footer>

      <div className={styles.legalBar}>
        <div className={`${styles.container} ${styles.legalInner}`}>
          <span>© 2026 CoBuilt Investment Partners. All rights reserved.</span>
          {/*
            Links rather than a flat assertion. The pages behind them state the
            actual conformance level and the known exceptions, which a badge
            alone would overstate.
          */}
          <span className={styles.legalBadge}>
            <a className={styles.legalLink} href="/accessibility">
              WCAG 2.2 AA
            </a>
            {' · '}
            <a className={styles.legalLink} href="/privacy">
              NDPA
            </a>
          </span>
        </div>
      </div>
    </>
  );
}
