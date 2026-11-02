import type { PublicVideo } from '@/lib/repositories/videos';
import { VIDEO_CATEGORY_LABEL, formatDuration, spokenDuration } from '@/lib/videos';
import { media } from '../../components/ui';
import { cssUrl } from '../projects/[slug]/project-shared';
import { formatMonth, posterFor, videoHref } from './video-shared';

/**
 * A video in a grid: the library, related videos, the leadership page.
 *
 * The still is the editor's thumbnail or the project's photograph, with a play
 * badge drawn over it; nothing here comes from YouTube. The whole card opens
 * the video's page (the title's link is stretched over it), and the project
 * link sits above that, so both are real links with their own names. Rendered
 * on the server and inside the library's client-side filters alike.
 */

export type VideoCardData = Pick<
  PublicVideo,
  'id' | 'slug' | 'title' | 'category' | 'thumbnailUrl' | 'durationSeconds' | 'recordedOn' | 'project'
>;

export default function VideoCard({
  video,
  headingLevel = 3,
  showProject = true,
}: {
  video: VideoCardData;
  headingLevel?: 2 | 3;
  /** Off on the project's own page, where the link would lead back to it. */
  showProject?: boolean;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const duration = formatDuration(video.durationSeconds);
  const spoken = spokenDuration(video.durationSeconds);
  const month = formatMonth(video.recordedOn);

  return (
    <article className="group relative flex flex-col border border-line bg-white">
      <div className="relative overflow-hidden bg-ink">
        <div
          className={`${media} aspect-video transition-transform duration-700 ease-settle group-hover:scale-104`}
          style={{ backgroundImage: cssUrl(posterFor(video)) }}
          role="img"
          aria-label={`Still from the video ${video.title}`}
        />
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span className="flex size-13 items-center justify-center rounded-full border-[1.5px] border-white bg-[rgb(20_20_20/86%)] text-[0.938rem] text-white transition-colors duration-150 group-hover:bg-orange group-hover:text-ink">
            ▶
          </span>
        </span>
        {duration ? (
          <span
            className="absolute right-2.5 bottom-2.5 bg-[rgb(20_20_20/88%)] px-2 py-1 font-mono text-[0.719rem] text-white"
            aria-hidden="true"
          >
            {duration}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-5.5">
        <p className="text-[0.656rem] tracking-[0.16em] text-zinc-600 uppercase">
          {VIDEO_CATEGORY_LABEL[video.category]}
          {month ? <span className="font-mono tracking-[0.08em]"> · {month}</span> : null}
        </p>
        <Heading className="text-[1.188rem] leading-[1.35] font-normal tracking-[-0.01em]">
          <a
            className="text-ink after:absolute after:inset-0 after:content-[''] hover:text-rust"
            href={videoHref(video.slug)}
          >
            {video.title}
            {spoken ? <span className="sr-only"> ({spoken})</span> : null}
          </a>
        </Heading>
        {showProject && video.project ? (
          <p className="relative z-10 mt-auto pt-1.5">
            <a
              className="inline-flex min-h-target items-center text-[0.688rem] font-semibold tracking-[0.14em] text-rust uppercase hover:text-rust-hover"
              href={`/projects/${video.project.slug}`}
            >
              <span className="sr-only">Project: </span>
              {video.project.title} →
            </a>
          </p>
        ) : null}
      </div>
    </article>
  );
}
