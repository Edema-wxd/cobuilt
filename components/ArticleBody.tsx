import type { ReactElement } from 'react';

/**
 * CMS-authored article body.
 *
 * `news_articles.content` is free text with no declared format: the CMS is not
 * settled (docs/design-handover.md §5.1), so it may arrive as plain prose, as
 * Markdown, or as HTML from a rich-text editor. This renders the common subset
 * safely and legibly rather than betting on one of them:
 *
 *   - It never uses `dangerouslySetInnerHTML`. An article body is editor input,
 *     and an editor account is not a licence to run script on this origin.
 *   - HTML tags are stripped to their text, so markup that does arrive reads as
 *     prose instead of showing angle brackets to the reader.
 *   - A Markdown subset is honoured — `##`/`###` headings, `-`/`*` and numbered
 *     lists, and `>` quotes — because that is what a Markdown-authored body
 *     would otherwise lose.
 *
 * Inline emphasis is deliberately not parsed: `**bold**` in the middle of a
 * sentence is a cosmetic loss, where a half-built inline parser is a real risk.
 * When the CMS is confirmed this file is the one place to replace.
 *
 * The measure is 760px and the body is 17px — airier than the legal pages,
 * which are dense by design (docs/design-handover.md §3.4).
 */

const BLOCK = 'mx-auto w-full max-w-190';
const paragraph = 'text-[1.0625rem] leading-[1.8] text-zinc-700';
const heading2 = 'text-[1.5rem] font-normal tracking-[-0.02em] text-ink';
const heading3 = 'text-[1.1875rem] font-medium tracking-[-0.01em] text-ink';
const list = 'flex flex-col gap-2.5 pl-5.5 text-[1.0625rem] leading-[1.75] text-zinc-700 marker:text-rust';
const quote =
  'border-l-3 border-orange pl-5 text-[1.1875rem] leading-[1.6] text-ink italic';

/** `<p>one</p><p>two</p>` has no blank line in it, so the tags become them. */
function toText(content: string): string {
  return content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const BULLET = /^[-*•]\s+/;
const NUMBERED = /^\d+[.)]\s+/;

function renderBlock(block: string, key: number): ReactElement | null {
  const lines = block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  const first = lines[0]!;

  if (first.startsWith('###')) {
    return (
      <h3 key={key} className={`${BLOCK} ${heading3}`}>
        {first.replace(/^#+\s*/, '')}
      </h3>
    );
  }

  if (first.startsWith('##')) {
    return (
      <h2 key={key} className={`${BLOCK} ${heading2}`}>
        {first.replace(/^#+\s*/, '')}
      </h2>
    );
  }

  if (first.startsWith('>')) {
    return (
      <blockquote key={key} className={`${BLOCK} ${quote}`}>
        {lines.map((line) => line.replace(/^>\s*/, '')).join(' ')}
      </blockquote>
    );
  }

  if (BULLET.test(first)) {
    return (
      <ul key={key} className={`${BLOCK} ${list} list-disc`}>
        {lines.map((line) => (
          <li key={line}>{line.replace(BULLET, '')}</li>
        ))}
      </ul>
    );
  }

  if (NUMBERED.test(first)) {
    return (
      <ol key={key} className={`${BLOCK} ${list} list-decimal`}>
        {lines.map((line) => (
          <li key={line}>{line.replace(NUMBERED, '')}</li>
        ))}
      </ol>
    );
  }

  return (
    <p key={key} className={`${BLOCK} ${paragraph}`}>
      {lines.join(' ')}
    </p>
  );
}

export default function ArticleBody({ content }: { content: string }) {
  const blocks = toText(content)
    .split(/\n{2,}/)
    .map(renderBlock)
    .filter((block): block is ReactElement => block !== null);

  if (blocks.length === 0) {
    return (
      <p className={`${BLOCK} ${paragraph}`}>
        This article has no body text yet.
      </p>
    );
  }

  return <div className="flex flex-col gap-6 sm:gap-7">{blocks}</div>;
}
