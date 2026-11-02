/**
 * YouTube links, as editors paste them.
 *
 * The homepage embeds one video an administrator chooses. Only a link on
 * YouTube's own hosts that names a single video is accepted, and only the
 * video ID is kept: the embed is built here from that ID, on the
 * privacy-enhanced youtube-nocookie.com host, so nothing an editor types ever
 * becomes an iframe `src` directly.
 *
 * Pure functions with no server imports, so the admin form can check a link
 * as it is typed with the same rule the API applies.
 */

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

const HOSTS = new Set(['youtube.com', 'youtu.be', 'youtube-nocookie.com']);

/** The 11-character video ID from a YouTube link, or null if it is not one. */
export function youtubeVideoId(value: string | null | undefined): string | null {
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, '');
  if (!HOSTS.has(host)) return null;

  const segments = url.pathname.split('/').filter(Boolean);
  let id: string | null | undefined;

  if (host === 'youtu.be') {
    // youtu.be/<id>
    id = segments.length === 1 ? segments[0] : null;
  } else if (segments[0] === 'watch' && segments.length === 1) {
    // youtube.com/watch?v=<id>
    id = url.searchParams.get('v');
  } else if (['embed', 'shorts', 'live', 'v'].includes(segments[0] ?? '') && segments.length === 2) {
    // youtube.com/embed/<id>, /shorts/<id>, /live/<id>
    id = segments[1];
  }

  return id && VIDEO_ID.test(id) ? id : null;
}

/** The canonical watch link, which is what is stored and what "Watch on YouTube" opens. */
export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/**
 * The privacy-enhanced embed. YouTube sets no cookies from this host until the
 * visitor plays the video; `autoplay` because the frame only exists after the
 * visitor has pressed play once already, and `rel=0` keeps the end screen to
 * this channel's own videos.
 */
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
}
