import { youtubeEmbedUrl, youtubeVideoId, youtubeWatchUrl } from '@/lib/youtube';

describe('YouTube links', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
    ['https://youtube.com/watch?v=dQw4w9WgXcQ&list=PL123'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?si=abc'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ'],
    ['https://www.youtube.com/live/dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ'],
    ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['  https://youtu.be/dQw4w9WgXcQ  '],
  ])('reads the video ID from %s', (url) => {
    expect(youtubeVideoId(url)).toBe('dQw4w9WgXcQ');
  });

  it.each([
    [null],
    [''],
    ['https://vimeo.com/76979871'],
    ['https://youtube.com.example.net/watch?v=dQw4w9WgXcQ'],
    ['https://notyoutube.com/watch?v=dQw4w9WgXcQ'],
    ['https://www.youtube.com/@cobuilt'],
    ['https://www.youtube.com/playlist?list=PL123'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ"onload="x'],
    ['https://youtu.be/dQw4w9WgXcQ/extra'],
    ['ftp://youtube.com/watch?v=dQw4w9WgXcQ'],
    ['javascript:alert(1)'],
  ])('rejects %s', (url) => {
    expect(youtubeVideoId(url)).toBeNull();
  });

  it('builds the watch link and the privacy-enhanced embed from the ID alone', () => {
    expect(youtubeWatchUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(youtubeEmbedUrl('dQw4w9WgXcQ')).toMatch(
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/,
    );
  });
});
