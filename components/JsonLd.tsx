import { jsonLdText } from '@/lib/seo';
import type { JsonLdObject } from '@/lib/structuredData';

/**
 * One block of Schema.org structured data (docs/decisions.md §2.27), built by
 * `src/lib/structuredData.ts`. Renders nothing for a null block, so a page can
 * pass a builder's result straight in.
 *
 * `dangerouslySetInnerHTML` is the only way to put text in a script element
 * without React escaping it into invalid JSON; `jsonLdText` escapes `<`, so
 * nothing in the data can close the element early. The report-only CSP does
 * not apply to it: `script-src` governs scripts a browser executes, and a
 * browser never executes `application/ld+json`.
 */
export default function JsonLd({ data }: { data: JsonLdObject | null }) {
  if (!data) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(data) }} />;
}
