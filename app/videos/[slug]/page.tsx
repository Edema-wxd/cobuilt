import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CtaBand from '../../../components/CtaBand';
import PageHero from '../../../components/PageHero';
import SiteLayout from '../../../components/SiteLayout';
import { bodyCopy, sectionHead, sectionLight, sectionMuted, titleMd } from '../../../components/sections';
import { btnOutline, container, eyebrow } from '../../../components/ui';
import { VIDEO_CATEGORY_LABEL, formatDuration } from '@/lib/videos';
import HomeVideo from '../../home-video';
import { loadVideoPage } from '../load-videos';
import VideoCard from '../video-card';
import { formatMonth, posterFor } from '../video-shared';

/**
 * Video page — `/videos/[slug]`.
 *
 * One published film: the click-to-load player (the homepage's, from
 * youtube-nocookie.com, requested only when the visitor presses play), its
 * description, the project it documents, and up to three films to watch next —
 * the same project's first, then the same category's.
 *
 * Rendered on its first request and regenerated at most once a minute, like
 * /leadership/[slug]; an unknown or unpublished film is a real 404. With no
 * database it says the film could not be loaded rather than failing.
 */

// Regenerated at most once a minute, like /videos.
export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** A description's paragraphs, split on blank lines. */
function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadVideoPage(slug);

  if (result.kind !== 'found') {
    // `absolute` because this is already the full title, so the root layout's
    // template must not append the house name a second time.
    return { title: { absolute: 'Video library — CoBuilt Investment Partners' } };
  }

  const { video } = result;
  const first = paragraphs(video.description)[0];
  const description =
    first && first.length <= 200
      ? first
      : `${VIDEO_CATEGORY_LABEL[video.category]}${video.project ? ` from ${video.project.title}` : ''}, in the CoBuilt video library.`;

  return {
    title: video.title,
    description,
    openGraph: {
      type: 'video.other',
      title: video.title,
      description,
      // The film's own still, as on the page; never YouTube's thumbnail.
      ...(video.thumbnailUrl ? { images: [video.thumbnailUrl] } : {}),
    },
  };
}

const factLabel = 'text-[0.656rem] font-semibold tracking-[0.18em] text-zinc-600 uppercase';
const factValue = 'text-[0.938rem] leading-[1.6] text-ink';
const factLink = 'inline-flex min-h-target items-center text-[0.938rem] text-rust underline hover:text-rust-hover';

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const result = await loadVideoPage(slug);

  if (result.kind === 'not-found') notFound();

  if (result.kind === 'unavailable') {
    return (
      <SiteLayout current="/media">
        <main>
          <PageHero
            eyebrow="Video library"
            title="This film couldn’t be loaded"
            standfirst="The library did not answer. This is on our side, not yours — try again shortly, or return to the video library."
            trail={[
              { label: 'Home', href: '/' },
              { label: 'Media', href: '/media' },
              { label: 'Video library', href: '/videos' },
              { label: 'Film' },
            ]}
          />
          <section className="bg-white py-13 sm:py-18">
            <div className={`${container} flex flex-col items-start gap-5`}>
              <a className={btnOutline} href="/videos">
                Back to the video library
              </a>
            </div>
          </section>
        </main>
      </SiteLayout>
    );
  }

  const { video, related } = result;
  const category = VIDEO_CATEGORY_LABEL[video.category];
  const duration = formatDuration(video.durationSeconds);
  const month = formatMonth(video.recordedOn);
  const body = paragraphs(video.description);
  const meta = [category, duration, month].filter(Boolean).join(' · ');

  return (
    <SiteLayout current="/media">
      <main>
        <PageHero
          eyebrow="Video library"
          title={video.title}
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Media', href: '/media' },
            { label: 'Video library', href: '/videos' },
            { label: video.title },
          ]}
          meta={meta}
        />

        <section className={sectionLight}>
          <div
            className={`${container} grid grid-cols-1 items-start gap-9 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-12`}
          >
            <div className="intro min-w-0">
              <HomeVideo id={video.youtubeId} title={video.title} poster={posterFor(video)} />
            </div>

            <div className="flex min-w-0 flex-col gap-7">
              <div className="flex flex-col gap-4">
                <p className={eyebrow}>About this film</p>
                {body.length > 0 ? (
                  body.map((part, index) => (
                    <p key={index} className={bodyCopy}>
                      {part}
                    </p>
                  ))
                ) : (
                  <p className={bodyCopy}>
                    {video.project
                      ? `Film from ${video.project.title}. The dated record behind it is in the project’s Passport™.`
                      : 'Film from the official CoBuilt YouTube channel.'}
                  </p>
                )}
              </div>

              <dl className="flex flex-col border-t border-line">
                <div className="flex flex-col gap-1 border-b border-line py-3">
                  <dt className={factLabel}>Category</dt>
                  <dd>
                    <a className={factLink} href={`/videos?category=${video.category}`}>
                      {category}
                      <span className="sr-only"> — more films in this category</span>
                    </a>
                  </dd>
                </div>
                {video.project ? (
                  <div className="flex flex-col gap-1 border-b border-line py-3">
                    <dt className={factLabel}>Project</dt>
                    <dd>
                      <a className={factLink} href={`/projects/${video.project.slug}`}>
                        {video.project.title}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {month ? (
                  <div className="flex flex-col gap-1 border-b border-line py-3">
                    <dt className={factLabel}>Recorded</dt>
                    <dd className={`${factValue} font-mono`}>{month}</dd>
                  </div>
                ) : null}
                {duration ? (
                  <div className="flex flex-col gap-1 border-b border-line py-3">
                    <dt className={factLabel}>Length</dt>
                    <dd className={`${factValue} font-mono`}>{duration}</dd>
                  </div>
                ) : null}
              </dl>

              <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3">
                {video.project ? (
                  <a className={btnOutline} href={`/projects/${video.project.slug}`}>
                    <span className="sr-only">{video.project.title}: </span>Open the project
                  </a>
                ) : null}
                <a className={btnOutline} href="/videos">
                  All videos
                </a>
              </div>
            </div>
          </div>
        </section>

        {related.length > 0 ? (
          <section className={sectionMuted} aria-labelledby="related-title">
            <div className={container}>
              <div className={`${sectionHead} mb-8 max-w-165 sm:mb-11`}>
                <p className={eyebrow}>Related videos</p>
                <h2 className={titleMd} id="related-title">
                  Watch next
                </h2>
              </div>
              <div className="reveal-stagger grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((item) => (
                  <VideoCard key={item.id} video={item} />
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <CtaBand
          title="Tell us what you are trying to build"
          body="Send the site, the brief or the question, and we will come back with a view on feasibility, programme and cost — in writing."
        />
      </main>
    </SiteLayout>
  );
}
