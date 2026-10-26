import type { AppProps } from 'next/app';
// Typefaces are bundled and served from our own origin, so no visitor data
// reaches a font CDN and the build needs no network access.
import '@fontsource-variable/archivo';
import '@fontsource-variable/source-serif-4/opsz.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '../styles/globals.css';
import { usePageViews } from '@/lib/client/pageViews';

export default function App({ Component, pageProps }: AppProps) {
  usePageViews();
  return <Component {...pageProps} />;
}
