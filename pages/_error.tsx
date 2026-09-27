import type { NextPageContext } from 'next';
import { ErrorScreen, NotFoundScreen } from '@/components/StatusScreen';

interface ErrorPageProps {
  statusCode?: number;
}

/**
 * Catches what 404.tsx and 500.tsx do not: other status codes, and runtime
 * errors thrown in the browser, which arrive with no status code at all.
 */
function ErrorPage({ statusCode }: ErrorPageProps) {
  if (statusCode === 404) return <NotFoundScreen />;
  return <ErrorScreen statusCode={statusCode} />;
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext): ErrorPageProps => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default ErrorPage;
