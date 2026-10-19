import {
  dayDiff,
  formatDay,
  formatQuarter,
  formatRecordedAt,
} from '../../app/projects/[slug]/project-shared';
import { describeDocument } from '../../app/projects/[slug]/passport/load-record';

/**
 * The Project Passport™ record's date and provenance logic.
 *
 * This page's whole claim is that its dates are accurate, which makes these
 * the functions most worth pinning down. They are also the functions that have
 * already been wrong once: `toDateOnly` reported a Passport opened on the 15th
 * as the 14th anywhere west of UTC (docs/decisions.md §2.11). None of these
 * read the host's zone, and this suite is what keeps it that way.
 */

describe('formatDay', () => {
  it('reads the calendar parts as stored', () => {
    expect(formatDay('2026-01-15')).toBe('15 Jan 2026');
    expect(formatDay('2026-12-01')).toBe('1 Dec 2026');
  });

  it('does not shift the day for a viewer west of UTC', () => {
    // The specific §2.11 bug: a DATE serialized as local midnight, pushed
    // through a zone-aware parse, reports the day before.
    const previous = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    try {
      expect(formatDay('2026-01-15')).toBe('15 Jan 2026');
    } finally {
      process.env.TZ = previous;
    }
  });

  it('accepts a full timestamp by reading only its date part', () => {
    expect(formatDay('2026-03-05T23:40:00.000Z')).toBe('5 Mar 2026');
  });

  it('returns null for anything that is not a date', () => {
    expect(formatDay(null)).toBeNull();
    expect(formatDay('')).toBeNull();
    expect(formatDay('soon')).toBeNull();
    expect(formatDay('2026-13-01')).toBeNull();
  });
});

describe('formatQuarter', () => {
  it('reports a completion target as the quarter it commits to', () => {
    expect(formatQuarter('2026-01-31')).toBe('Q1 2026');
    expect(formatQuarter('2026-04-01')).toBe('Q2 2026');
    expect(formatQuarter('2026-09-30')).toBe('Q3 2026');
    expect(formatQuarter('2026-10-01')).toBe('Q4 2026');
  });

  it('returns null for anything that is not a date', () => {
    expect(formatQuarter(null)).toBeNull();
    expect(formatQuarter('2026')).toBeNull();
  });
});

describe('dayDiff', () => {
  it('is positive when the milestone was met after the published date', () => {
    expect(dayDiff('2026-01-15', '2026-01-20')).toBe(5);
  });

  it('is negative when it was met early, and zero when it was met on the day', () => {
    expect(dayDiff('2026-01-20', '2026-01-15')).toBe(-5);
    expect(dayDiff('2026-01-15', '2026-01-15')).toBe(0);
  });

  it('counts across a month, a year and a leap day without drifting', () => {
    expect(dayDiff('2026-01-31', '2026-02-01')).toBe(1);
    expect(dayDiff('2026-12-31', '2027-01-01')).toBe(1);
    expect(dayDiff('2028-02-28', '2028-03-01')).toBe(2);
  });

  it('returns null unless both dates are present', () => {
    expect(dayDiff('2026-01-15', null)).toBeNull();
    expect(dayDiff(null, '2026-01-15')).toBeNull();
  });
});

describe('formatRecordedAt', () => {
  /**
   * Provenance is the point of the timestamp, so it is reported in the zone the
   * record is kept in — West Africa Time, a fixed UTC+1 — rather than in the
   * zone of whichever server rendered the page.
   */
  it('converts the instant to West Africa Time', () => {
    expect(formatRecordedAt('2026-09-02T13:32:00.000Z')).toBe('2 Sep 2026 · 14:32 WAT');
  });

  it('carries the hour across midnight and the year with it', () => {
    expect(formatRecordedAt('2026-09-02T23:30:00.000Z')).toBe('3 Sep 2026 · 00:30 WAT');
    expect(formatRecordedAt('2026-12-31T23:00:00.000Z')).toBe('1 Jan 2027 · 00:00 WAT');
  });

  it('reports the same instant whatever zone the server keeps', () => {
    const previous = process.env.TZ;
    for (const zone of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo', 'Africa/Lagos']) {
      process.env.TZ = zone;
      expect(formatRecordedAt('2026-09-02T13:32:00.000Z')).toBe('2 Sep 2026 · 14:32 WAT');
    }
    process.env.TZ = previous;
  });

  it('returns null for a missing or unparseable instant', () => {
    expect(formatRecordedAt(null)).toBeNull();
    expect(formatRecordedAt('not a time')).toBeNull();
  });
});

describe('describeDocument', () => {
  it('names a document from the last segment of its URL', () => {
    expect(describeDocument('https://cdn.example.com/docs/foundation-certificate.pdf')).toEqual({
      url: 'https://cdn.example.com/docs/foundation-certificate.pdf',
      name: 'Foundation certificate',
      kind: 'PDF',
    });
  });

  it('decodes a percent-encoded name', () => {
    expect(
      describeDocument('https://cdn.example.com/Structural%20Report%20Q3.docx').name,
    ).toBe('Structural Report Q3');
  });

  it('uses the raw segment when it will not decode', () => {
    // A lone '%' is not valid encoding, and a link reading "Document" is worse
    // than a link reading the filename as it came. The separators still read
    // as spaces, as they do for a name that decoded cleanly.
    expect(describeDocument('https://cdn.example.com/100%-complete.pdf').name).toBe(
      '100% complete',
    );
  });

  it('carries no kind when the extension is not one', () => {
    expect(describeDocument('https://cdn.example.com/docs/handover').kind).toBeNull();
    expect(describeDocument('https://cdn.example.com/a.verylongextension').kind).toBeNull();
  });

  it('falls back to a name rather than an empty label', () => {
    expect(describeDocument('https://cdn.example.com/docs/').name).toBe('Document');
  });

  it('ignores the query string, which is a CDN signature and not a name', () => {
    const described = describeDocument(
      'https://cdn.example.com/docs/roofing-report.pdf?X-Amz-Signature=abc',
    );
    expect(described.name).toBe('Roofing report');
    expect(described.kind).toBe('PDF');
  });
});
