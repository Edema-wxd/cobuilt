import type { Metadata } from 'next';
import { canonical } from '@/lib/seo';
import PageHero from '../../components/PageHero';
import SiteLayout from '../../components/SiteLayout';
import {
  bodyCopy,
  cardBody,
  cardTitle,
  glyph,
  sectionHead,
  sectionLight,
  sectionMuted,
  titleMd,
  titleSm,
  uppercaseLink,
} from '../../components/sections';
import {
  btnOrange,
  btnOutline,
  btnOutlineOnDark,
  btnWhite,
  container,
  eyebrow,
  eyebrowOnDark,
  media,
} from '../../components/ui';
import { newsCategoryLabel, type NewsCategory } from '@/lib/news-categories';
import { cssUrl } from '../projects/[slug]/project-shared';
import { loadMediaCentre, type MediaArticle, type MediaCategoryGroup } from './load-media';

/**
 * Media centre — `/media`.
 *
 * The front page of the spec's Media section: Media → News, Videos, Gallery,
 * Articles. It does two things. It opens onto the four collections — news and
 * articles (`/news`), the video library (`/videos`), the image gallery
 * (`/gallery`) and downloads (`/resources`) — and it shows the newest articles
 * in each of the five categories, each row linking to that category's filtered
 * list on `/news`. It closes with the press desk.
 *
 * Server-rendered from the repository (`load-media.ts`), like the landing
 * page's news band, rather than read on the client like `/news`: there are no
 * filters here, so there is nothing for the browser to ask for, and the
 * articles are in the HTML as served. With no database — as at build time — the
 * loader returns nothing and the page shows its empty state, never a 500.
 */

// Regenerated at most once a minute, so an article published in the console
// reaches this page in the same minute it reaches /news.
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Media centre',
  description:
    'News, articles, video, photography and downloads from CoBuilt Investment Partners: press releases, project updates, thought leadership, industry insight and company announcements.',
  alternates: canonical('/media'),
};

const FALLBACK_IMAGE = '/images/apartment-blocks.webp';

/** The four collections the section is made of, in the spec's order. */
const COLLECTIONS: Array<{ glyph: string; title: string; body: string; href: string; action: string }> = [
  {
    glyph: '▤',
    title: 'News & articles',
    body: 'Press releases, project updates, thought leadership, industry insight and company announcements — searchable, and filtered by category.',
    href: '/news',
    action: 'Read the news',
  },
  {
    glyph: '►',
    title: 'Video library',
    body: 'Project films, footage from site and interviews, played on the page.',
    href: '/videos',
    action: 'Watch the videos',
  },
  {
    glyph: '▦',
    title: 'Image gallery',
    body: 'Photography of the developments, from the site to the finished building.',
    href: '/gallery',
    action: 'View the gallery',
  },
  {
    glyph: '↓',
    title: 'Downloads',
    body: 'The company profile, project brochures and certificates, as files to keep.',
    href: '/resources',
    action: 'Browse downloads',
  },
];

/** Each category's row heading, its one-line remit, and the link to all of it. */
const CATEGORY_COPY: Record<NewsCategory, { heading: string; remit: string; all: string }> = {
  press_release: {
    heading: 'Press releases',
    remit: 'Statements issued to the press: ground-breakings, completions and milestones.',
    all: 'All press releases',
  },
  project_update: {
    heading: 'Project updates',
    remit: 'Progress on the developments, summarised. The dated record is each project’s Passport™.',
    all: 'All project updates',
  },
  thought_leadership: {
    heading: 'Thought leadership',
    remit: 'How we think about delivery, transparency and building well, from the people accountable for it.',
    all: 'All thought leadership',
  },
  industry_insight: {
    heading: 'Industry insights',
    remit: 'The market, regulation and construction practice that shape the projects.',
    all: 'All industry insights',
  },
  company_announcement: {
    heading: 'Company announcements',
    remit: 'News from inside CoBuilt: appointments, partnerships and policies.',
    all: 'All company announcements',
  },
};

/** Articles with no category, or one the CMS sent of its own. */
const OTHER_COPY = {
  heading: 'More news',
  remit: 'Everything else published to the media centre.',
  all: 'All news and articles',
};

function copyFor(category: NewsCategory | null) {
  return category ? CATEGORY_COPY[category] : OTHER_COPY;
}

function categoryHref(category: NewsCategory | null): string {
  return category ? `/news?category=${category}` : '/news';
}

function ArticleCard({ article }: { article: MediaArticle }) {
  return (
    <article className="flex flex-col gap-3">
      <a className="group flex flex-col gap-3" href={`/news/${article.slug}`}>
        <div className="overflow-hidden">
          <div
            className={`${media} aspect-[16/10] transition-transform duration-700 ease-settle group-hover:scale-104 sm:aspect-auto sm:h-44`}
            style={{ backgroundImage: cssUrl(article.image ?? FALLBACK_IMAGE) }}
            // A missing featured image is ordinary CMS data: the house still, unlabelled.
            {...(article.image ? { role: 'img', 'aria-label': article.title } : { 'aria-hidden': true })}
          />
        </div>
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-[0.688rem] tracking-[0.16em] text-zinc-600 uppercase">
          {article.category ? (
            <span className="text-rust">{newsCategoryLabel(article.category)}</span>
          ) : null}
          {article.published ? <span>{article.published}</span> : null}
        </p>
        <h4 className="text-[1.0625rem] leading-[1.35] font-normal tracking-normal text-ink group-hover:text-rust">
          {article.title}
        </h4>
      </a>
      {article.excerpt ? (
        <p className="line-clamp-3 text-[0.875rem] leading-[1.65] text-zinc-600">{article.excerpt}</p>
      ) : null}
    </article>
  );
}

/** One category: its heading and remit beside its newest articles. */
function CategoryRow({ group }: { group: MediaCategoryGroup }) {
  const copy = copyFor(group.category);
  const id = `latest-${group.category ?? 'other'}`;

  return (
    <section
      className="grid grid-cols-1 gap-6 border-t border-zinc-300 pt-8 first:border-t-0 first:pt-0 sm:pt-10 lg:grid-cols-[15rem_1fr] lg:gap-10"
      aria-labelledby={id}
    >
      <div className="reveal flex flex-col items-start gap-2.5">
        <h3 className="text-[1.375rem] leading-[1.2]" id={id}>
          {copy.heading}
        </h3>
        <p className={cardBody}>{copy.remit}</p>
        <a
          className={`${uppercaseLink} inline-flex min-h-target items-center text-[0.688rem]`}
          href={categoryHref(group.category)}
        >
          {copy.all} →
        </a>
      </div>
      <div className="reveal-stagger grid grid-cols-1 gap-9 sm:grid-cols-2 sm:gap-6 md:grid-cols-3">
        {group.articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
    </section>
  );
}

export default async function MediaCentre() {
  const groups = await loadMediaCentre();

  return (
    <SiteLayout current="/media">
      <main>
        <PageHero
          eyebrow="Media centre"
          title={
            <>
              News, film, photography and <em>the record</em>.
            </>
          }
          standfirst="Company news and articles, the video library, the image gallery and downloads, in one place. Project progress itself is published to each development’s Project Passport™."
          trail={[{ label: 'Home', href: '/' }, { label: 'Media' }]}
          actions={
            <>
              <a className={btnWhite} href="/news">
                All news &amp; articles
              </a>
              <a className={btnOutlineOnDark} href="/contact">
                Media enquiries
              </a>
            </>
          }
        />

        <section className={sectionLight} aria-labelledby="collections-title">
          <div className={container}>
            <div className={`${sectionHead} mb-8 max-w-165 sm:mb-11 [&_h2_em]:text-rust`}>
              <p className={eyebrow}>The media centre</p>
              <h2 className={titleMd} id="collections-title">
                Four ways <em>in</em>.
              </h2>
            </div>

            {/* Each card draws its own right and bottom rule, as on /services. */}
            <ul className="reveal grid grid-cols-1 border-t border-l border-zinc-300 sm:grid-cols-2 lg:grid-cols-4">
              {COLLECTIONS.map((collection) => (
                <li
                  key={collection.href}
                  className="flex flex-col gap-3 border-r border-b border-zinc-300 bg-white p-6 sm:p-8"
                >
                  <span className={`${glyph} text-orange`} aria-hidden="true">
                    {collection.glyph}
                  </span>
                  <h3 className={`${cardTitle} tracking-[0.16em]`}>{collection.title}</h3>
                  <p className={cardBody}>{collection.body}</p>
                  <a
                    className={`${uppercaseLink} mt-auto inline-flex min-h-target items-center self-start pt-2 text-[0.719rem]`}
                    href={collection.href}
                  >
                    {collection.action} →
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={sectionMuted} aria-labelledby="latest-title">
          <div className={container}>
            <div className={`${sectionHead} mb-8 max-w-165 sm:mb-11`}>
              <p className={eyebrow}>Latest</p>
              <h2 className={titleMd} id="latest-title">
                From the newsroom, by category
              </h2>
            </div>

            {groups.length > 0 ? (
              <div className="flex flex-col gap-10 sm:gap-12">
                {groups.map((group) => (
                  <CategoryRow key={group.category ?? 'other'} group={group} />
                ))}
              </div>
            ) : (
              // Nothing published, or the article store did not answer (as at
              // build time). Either way the list on /news says which.
              <div className="flex flex-col items-start gap-4 border border-line bg-white p-7 sm:p-10">
                <p className={eyebrow}>Nothing here yet</p>
                <h3 className={titleSm}>No articles to show</h3>
                <p className={`${bodyCopy} max-w-150`}>
                  Press releases, project updates and articles will appear here as they are
                  published. Project progress is recorded continuously in each development&rsquo;s
                  Project Passport™.
                </p>
                <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3">
                  <a className={btnOutline} href="/news">
                    Go to news &amp; articles
                  </a>
                  <a className={btnOutline} href="/projects">
                    Browse the projects
                  </a>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="bg-ink py-13 sm:py-16 md:py-20" aria-labelledby="press-title">
          <div
            className={`${container} reveal-stagger grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.2fr_1fr] lg:gap-13`}
          >
            <div className="flex flex-col gap-4 [&_h2_em]:text-orange-on-dark">
              <p className={eyebrowOnDark}>Press desk</p>
              <h2 className={`${titleSm} text-white`} id="press-title">
                Media <em>enquiries</em>
              </h2>
              <p className="max-w-135 text-[0.969rem] leading-[1.75] text-zinc-200">
                Interview requests, comment, project imagery and footage go to the press desk through
                the contact page. Say which outlet you write for, and your deadline.
              </p>
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap lg:flex-col lg:items-stretch">
              <a className={btnOrange} href="/contact">
                Make a media enquiry
              </a>
              <a className={btnOutlineOnDark} href="/resources">
                Downloads
              </a>
            </div>
          </div>
        </section>
      </main>
    </SiteLayout>
  );
}
