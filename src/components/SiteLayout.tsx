import Link from 'next/link';
import type { ReactNode } from 'react';
import site from '../../styles/Site.module.css';

const NAV = [
  { href: '/#passport', label: 'Passport' },
  { href: '/#projects', label: 'Projects' },
  { href: '/#investors', label: 'Investors' },
];

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className={site.page}>
      <a className={site.skipLink} href="#content">
        Skip to content
      </a>

      <header className={site.nav}>
        <div className={`${site.container} ${site.navInner}`}>
          <Link className={site.wordmark} href="/">
            <span className={site.wordmarkName}>COBUILT</span>
            <span className={site.wordmarkSub}>Investment Partners</span>
          </Link>
          <nav className={site.navLinks} aria-label="Primary">
            {NAV.map((item) => (
              <Link key={item.href} className={site.navLink} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <Link className={site.btnPrimary} href="/#updates">
            Get updates
          </Link>
        </div>
      </header>

      <main id="content" className={site.main}>
        {children}
      </main>

      <footer className={site.footer}>
        <div className={site.container}>
          <div className={site.footerGrid}>
            <div>
              <p className={site.wordmarkName}>COBUILT</p>
              <p className={site.footerBlurb}>
                Development, project management and asset management across real estate,
                hospitality, retail and industrial property in Nigeria.
              </p>
            </div>
            <div>
              <p className={site.footerHead}>Site</p>
              <ul className={site.footerList}>
                <li>
                  <Link href="/#passport">Project Passport</Link>
                </li>
                <li>
                  <Link href="/#projects">Projects</Link>
                </li>
                <li>
                  <Link href="/#investors">Investors</Link>
                </li>
                <li>
                  <Link href="/#updates">Milestone updates</Link>
                </li>
              </ul>
            </div>
            <div>
              <p className={site.footerHead}>Offices</p>
              <ul className={site.footerList}>
                <li>Lekki, Lagos</li>
                <li>Ikoyi, Lagos</li>
                <li>Maitama, Abuja</li>
                <li>Port Harcourt</li>
              </ul>
            </div>
            <div>
              <p className={site.footerHead}>Legal</p>
              <ul className={site.footerList}>
                <li>
                  <Link href="/terms">Terms of service</Link>
                </li>
                <li>
                  <Link href="/privacy">Privacy policy</Link>
                </li>
                <li>
                  <Link href="/privacy#your-rights">Export or erasure</Link>
                </li>
                <li>
                  <a href="/api/health">Service status</a>
                </li>
              </ul>
            </div>
          </div>
          <div className={site.footerBottom}>
            <span>© 2026 CoBuilt Investment Partners</span>
            <span>Project Passport™</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
