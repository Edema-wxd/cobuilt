import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ArticleBody from '../../../components/ArticleBody';
import PageHero from '../../../components/PageHero';
import SiteLayout from '../../../components/SiteLayout';
import {
  bodyCopy,
  cardBody,
  sectionHead,
  titleMd,
} from '../../../components/sections';
import { btnOutline, container, eyebrow, media } from '../../../components/ui';
import { loadArticle } from './load-article';
import type { ArticleSummary } from './load-article';

/**
 * Article — `/news/[slug]`.
 *
 * Renders on the server. An article is the canonical, shareable URL for a piece
 * of company news: it needs its own SEO fields in the document head, an Open
 * Graph image for link previews, and a real 404 for a slug that does not exist
 * — none of which a client-side fetch gives. The same reasoning as the project
 * page; see docs/decisions.md §2.10.
 *
 * A checkout with no database still renders: the load is wrapped, and a failure
 * shows the "couldn't be loaded" state rather than a 500.
 *
 * The body is server-rendered too. `ArticleBody` takes CMS text and renders it
 * without `dangerouslySetInnerHTML` — see that file for why.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

const FALLBACK_IMAGE = '/images/apartment-blocks.webp';

function categoryLabel(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/^./, (character) => character.toUpperCase());
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadArticle(slug);

  if (result.kind !== 'found') {
    // `absolute` because this is already the full title, so the root layout's
    // template must not append the house name a second time.
    return { title: { absolute: 'Article — CoBuilt Investment Partners' } };
  }

  const { article } = result.props;
  const description =
    article.seo.metaDescription ??
    article.excerpt ??
    `${article.title} — company news from CoBuilt Investment Partners.`;

  return {
    title: { absolute: article.seo.metaTitle ?? `${article.title} — CoBuilt Investment Partners` },
    description,
    openGraph: {
      type: 'article',
      title: article.title,
      description,
      ...(article.publishedAt ? { publishedTime: article.publishedAt } : {}),
      ...(article.featuredImageUrl ? { images: [article.featuredImageUrl] } : {}),
    },
    // Always large: a page without its own image has a generated card
    // (opengraph-image.tsx beside it).
    twitter: { card: 'summary_large_image' },
  };
}

/** The related-article card, also used for the "unavailable" state's links. */
function RelatedCard({ article }: { article: ArticleSummary }) {
  return (
    <article className="flex flex-col gap-3.5">
      <a className="group flex flex-col gap-3.5" href={`/news/${article.slug}`}>
        <div
          className={`${media} aspect-[16/10] sm:aspect-auto sm:h-45`}
          style={{ backgroundImage: `url('${article.featuredImageUrl ?? FALLBACK_IMAGE}')` }}
          {...(article.featuredImageUrl
            ? { role: 'img', 'aria-label': article.title }
            : { 'aria-hidden': true })}
        />
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-[0.688rem] tracking-[0.16em] text-zinc-500 uppercase">
          {article.category ? (
            <span className="text-rust">{categoryLabel(article.category)}</span>
          ) : null}
          <span>{formatDate(article.publishedAt)}</span>
        </p>
        <h3 className="text-[1.0625rem] leading-[1.35] font-normal tracking-normal text-ink group-hover:text-rust">
          {article.title}
        </h3>
      </a>
      {article.excerpt ? <p className={cardBody}>{article.excerpt}</p> : null}
    </article>
  );
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const result = await loadArticle(slug);

  if (result.kind === 'not-found') notFound();

  if (result.kind === 'unavailable') {
    return (
      <SiteLayout current="/news">
        <main>
          <PageHero
            eyebrow="Media centre"
            title="This article couldn’t be loaded"
            standfirst="The article store did not answer. This is on our side, not yours — try again shortly, or browse the media centre."
            trail={[
              { label: 'Home', href: '/' },
              { label: 'Media', href: '/news' },
              { label: 'Article' },
            ]}
          />
          <section className="bg-white py-13 sm:py-18">
            <div className={`${container} flex flex-col items-start gap-5`}>
              <p className={bodyCopy}>
                If this keeps happening, tell us. A site that publishes a record should be the first
                to hear when the record is unreachable.
              </p>
              <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3">
                <a className={btnOutline} href="/news">
                  Back to the media centre
                </a>
                <a className={btnOutline} href="/contact">
                  Report it
                </a>
              </div>
            </div>
          </section>
        </main>
      </SiteLayout>
    );
  }

  const { article, related } = result.props;
  const published = formatDate(article.publishedAt);
  const updated = formatDate(article.updatedAt);

  return (
    <SiteLayout current="/news">
      <main>
        <PageHero
          eyebrow={article.category ? categoryLabel(article.category) : 'Media centre'}
          title={article.title}
          {...(article.excerpt ? { standfirst: article.excerpt } : {})}
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Media', href: '/news' },
            { label: article.title },
          ]}
          meta={
            <>
              {published ? <>Published {published}</> : <>Not yet dated</>}
              {article.author ? <> · {article.author}</> : null}
              {updated && updated !== published ? <> · Updated {updated}</> : null}
            </>
          }
        />

        {article.featuredImageUrl ? (
          <div
            className={`${media} aspect-[16/9] w-full sm:aspect-auto sm:h-115`}
            style={{ backgroundImage: `url('${article.featuredImageUrl}')` }}
            role="img"
            aria-label={article.title}
          />
        ) : null}

        <article className="bg-white pt-11 pb-13 sm:pt-14 sm:pb-18 md:pt-18 md:pb-22">
          <div className={container}>
            <ArticleBody content={article.content} />

            {article.tags.length > 0 ? (
              <div className="mx-auto mt-10 flex w-full max-w-190 flex-wrap items-center gap-2 border-t border-line pt-6 sm:mt-12">
                <span className="mr-1 text-[0.656rem] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                  Tagged
                </span>
                {article.tags.map((tag) => (
                  <a
                    key={tag}
                    className="inline-flex min-h-target items-center border border-zinc-500 px-3.5 text-[0.688rem] font-medium tracking-[0.1em] text-ink uppercase hover:border-ink"
                    href={`/news?tag=${encodeURIComponent(tag)}`}
                  >
                    {tag}
                  </a>
                ))}
              </div>
            ) : null}

            <div className="mx-auto mt-8 flex w-full max-w-190 flex-col gap-2.5 border-l-3 border-orange bg-zinc-100 px-5.5 py-5">
              <p className="text-[0.719rem] font-bold uppercase tracking-[0.16em] text-ink">
                About project updates
              </p>
              <p className="text-[0.906rem] leading-[1.75] text-zinc-700">
                News items summarise progress. The record itself — dated milestones, site
                photography and certificates — is published to each development&rsquo;s{' '}
                <a className="text-rust underline hover:text-rust-hover" href="/passport">
                  Project Passport™
                </a>
                .
              </p>
            </div>
          </div>
        </article>

        {related.length > 0 ? (
          <section className="border-t border-line bg-zinc-100 py-11 sm:py-14 md:py-18">
            <div className={container}>
              <div className={`${sectionHead} mb-7 max-w-150 sm:mb-9`}>
                <p className={eyebrow}>More from the media centre</p>
                <h2 className={titleMd}>Related reading</h2>
              </div>
              <div className="reveal-stagger grid grid-cols-1 gap-9 sm:grid-cols-2 sm:gap-6 md:grid-cols-3">
                {related.map((item) => (
                  <RelatedCard key={item.id} article={item} />
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="bg-white py-11 sm:py-14">
          <div
            className={`${container} flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8`}
          >
            <p className={`${bodyCopy} max-w-150`}>
              Follow the developments as they progress: project updates, company news and Project
              Passport™ notifications, by email.
            </p>
            <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:gap-3">
              <a className={`${btnOutline} w-full sm:w-auto`} href="/#register">
                Register your interest
              </a>
              <a className={`${btnOutline} w-full sm:w-auto`} href="/news">
                All articles
              </a>
            </div>
          </div>
        </section>
      </main>
    </SiteLayout>
  );
}
