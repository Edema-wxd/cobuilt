import type { Metadata } from 'next';
import FaqList from './faq-list';

/**
 * FAQs — `/faqs`. Search results link here with the question's id as the
 * fragment, so each entry has a stable anchor.
 */
export const metadata: Metadata = {
  title: 'Frequently asked questions',
  description:
    'Answers about Project Passport™, how CoBuilt handles personal data, and the regulatory position on investment.',
};

export const dynamic = 'force-dynamic';

export default function Page() {
  return <FaqList />;
}
