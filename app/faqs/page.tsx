import type { Metadata } from 'next';
import { canonical } from '@/lib/seo';
import { faqPage } from '@/lib/structuredData';
import JsonLd from '../../components/JsonLd';
import FaqList from './faq-list';

/**
 * FAQs — `/faqs`. Search results link here with the question's id as the
 * fragment, so each entry has a stable anchor.
 */
export const metadata: Metadata = {
  title: 'Frequently asked questions',
  description:
    'Answers about Project Passport™, how CoBuilt handles personal data, and the regulatory position on investment.',
  alternates: canonical('/faqs'),
};

export const dynamic = 'force-dynamic';

/**
 * The published questions for the page's `FAQPage` block. The list itself
 * still loads in the browser from `/api/faqs`; this reads the same rows
 * through the same Redis entry, so the two cannot disagree. Without a
 * database there is no block, and the list says it could not be loaded.
 */
async function loadFaqs(): Promise<Array<{ question: string; answer: string }>> {
  try {
    const { TTL, key, remember } = await import('@/lib/cache');
    const faqs = await import('@/lib/repositories/faqs');
    return await remember(key('faqs:list', {}), TTL.news, () => faqs.listPublished());
  } catch (error) {
    const { logger } = await import('@/lib/logger');
    logger.warn('FAQs unavailable for structured data', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export default async function Page() {
  const faqs = await loadFaqs();
  return (
    <>
      <JsonLd data={faqPage(faqs)} />
      <FaqList />
    </>
  );
}
