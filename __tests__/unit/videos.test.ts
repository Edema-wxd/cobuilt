import { formatDuration, parseDuration, spokenDuration } from '@/lib/videos';
import { formatMonth, posterFor } from '../../app/videos/video-shared';

describe('video durations', () => {
  it('reads what an editor types', () => {
    expect(parseDuration('6:42')).toBe(402);
    expect(parseDuration(' 1:02:05 ')).toBe(3725);
    expect(parseDuration('90')).toBe(90);
    expect(parseDuration('')).toBeNull();
    for (const bad of ['6:4', '6:60', '0', '0:00', 'six minutes', '-5', '1:2:3:4']) {
      expect(parseDuration(bad)).toBeUndefined();
    }
  });

  it('prints and speaks a duration', () => {
    expect(formatDuration(402)).toBe('6:42');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(null)).toBeNull();
    expect(spokenDuration(402)).toBe('6 minutes 42 seconds');
    expect(spokenDuration(3600)).toBe('1 hour');
    // What is printed is what an editor can type back.
    expect(parseDuration(formatDuration(3725)!)).toBe(3725);
  });
});

describe('video cards', () => {
  it('dates a film by its own calendar month', () => {
    expect(formatMonth('2026-03-01')).toBe('Mar 2026');
    expect(formatMonth('2026-13-01')).toBeNull();
    expect(formatMonth(null)).toBeNull();
  });

  it('never falls back to a YouTube thumbnail', () => {
    expect(posterFor({ thumbnailUrl: 'https://img.cobuilt.test/still.jpg' })).toBe('https://img.cobuilt.test/still.jpg');
    expect(posterFor({ thumbnailUrl: null })).toBe('/images/construction-site.webp');
  });
});
