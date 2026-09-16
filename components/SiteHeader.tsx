import { useState } from 'react';
import styles from '../styles/Chrome.module.css';
import { EMAIL, NAV, PHONE, PHONE_HREF } from './site';

interface Props {
  /** href of the nav item to mark current, e.g. "/" or "/careers". */
  current?: string;
}

export default function SiteHeader({ current = '/' }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className={styles.utility}>
        <div className={`${styles.container} ${styles.utilityInner}`}>
          <div className={styles.utilityContact}>
            <a href={PHONE_HREF}>{PHONE}</a>
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
          </div>
          <div className={styles.utilitySocial}>
            <a href="/#register">WhatsApp Business</a>
            <a href="/#register">LinkedIn</a>
            <a href="/#leadership">YouTube</a>
            <a className={styles.utilitySearch} href="/#projects">
              Search
            </a>
          </div>
        </div>
      </div>

      <header className={styles.header}>
        <div className={`${styles.container} ${styles.headerInner}`}>
          <a href="/" aria-label="CoBuilt Investment Partners — home">
            <img
              className={styles.logo}
              src="/images/cobuilt-logo-light.webp"
              alt="CoBuilt Investment Partners"
              width={112}
              height={38}
            />
          </a>

          <nav className={open ? `${styles.nav} ${styles.navOpen}` : styles.nav} aria-label="Main">
            {NAV.map((item) => {
              const isCurrent = item.href === current;
              return (
                <a
                  key={item.label}
                  className={isCurrent ? styles.navLinkActive : styles.navLink}
                  href={item.href}
                  aria-current={isCurrent ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              );
            })}
            <a className={styles.navCta} href="/#register">
              Discuss your project
            </a>
          </nav>

          <button
            className={styles.navToggle}
            type="button"
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((value) => !value)}
          >
            <span className={styles.navToggleBars} aria-hidden="true" />
          </button>
        </div>
      </header>
    </>
  );
}
