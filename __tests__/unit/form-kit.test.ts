import {
  changedFields,
  firstBadUrl,
  fromWatInput,
  lines,
  publicationFrom,
  publishedAtFor,
  toWatInput,
} from '../../app/admin/form-kit';

/**
 * The console editors' pure helpers. changedFields is what keeps an untouched
 * investor figure out of a project update — resending one withdraws legal
 * approval — so it is tested directly rather than through a screen.
 */

describe('changedFields', () => {
  it('returns only the fields whose value differs', () => {
    expect(
      changedFields(
        { title: 'Ocean Ridge', expectedRoi: 18.5, tagIds: ['a'] },
        { title: 'Ocean Ridge Residences', expectedRoi: 18.5, tagIds: ['a'] },
      ),
    ).toEqual({ title: 'Ocean Ridge Residences' });
  });

  it('compares arrays and objects by value', () => {
    expect(changedFields({ tagIds: ['a', 'b'] }, { tagIds: ['a', 'b'] })).toEqual({});
    expect(changedFields({ tagIds: ['a', 'b'] }, { tagIds: ['b', 'a'] })).toEqual({ tagIds: ['b', 'a'] });
  });

  it('skips fields the caller left undefined, and sends a cleared field as null', () => {
    expect(
      changedFields(
        { investmentAmount: 1000, brochureUrl: 'https://x.test/a.pdf' },
        { investmentAmount: undefined, brochureUrl: null },
      ),
    ).toEqual({ brochureUrl: null });
  });
});

describe('WAT conversion', () => {
  it('shows an instant as WAT wall-clock time', () => {
    expect(toWatInput('2026-10-26T08:30:00.000Z')).toBe('2026-10-26T09:30');
  });

  it('reads a wall-clock time as WAT', () => {
    expect(fromWatInput('2026-10-26T09:30')).toBe('2026-10-26T08:30:00.000Z');
  });

  it('crosses midnight correctly', () => {
    expect(toWatInput('2026-12-31T23:30:00.000Z')).toBe('2027-01-01T00:30');
  });
});

describe('publication', () => {
  const past = '2026-01-15T10:00:00.000Z';
  const future = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

  it('classifies a stored date', () => {
    expect(publicationFrom(null).mode).toBe('draft');
    expect(publicationFrom(past).mode).toBe('live');
    expect(publicationFrom(future).mode).toBe('scheduled');
  });

  it('keeps the original date when something already live is saved again', () => {
    expect(publishedAtFor({ mode: 'live', at: '' }, past)).toBe(past);
  });

  it('publishes a draft at the moment it is saved', () => {
    const before = Date.now();
    const at = publishedAtFor({ mode: 'live', at: '' }, null);
    expect(new Date(at!).getTime()).toBeGreaterThanOrEqual(before);
  });

  it('keeps an untouched schedule exactly, seconds included', () => {
    const scheduled = '2030-03-01T07:15:42.123Z';
    expect(publishedAtFor(publicationFrom(scheduled), scheduled)).toBe(scheduled);
  });

  it('takes a changed schedule as WAT', () => {
    expect(publishedAtFor({ mode: 'scheduled', at: '2030-03-01T09:00' }, null)).toBe(
      '2030-03-01T08:00:00.000Z',
    );
  });

  it('withdraws to draft', () => {
    expect(publishedAtFor({ mode: 'draft', at: '' }, past)).toBeNull();
  });
});

describe('list fields', () => {
  it('reads one entry per non-empty line', () => {
    expect(lines(' https://a.test/1 \n\n https://a.test/2\n')).toEqual(['https://a.test/1', 'https://a.test/2']);
  });

  it('finds the first entry that is not a web address', () => {
    expect(firstBadUrl(['https://a.test', 'a.test/video', 'javascript:alert(1)'])).toBe('a.test/video');
    expect(firstBadUrl(['https://a.test', 'http://b.test'])).toBeNull();
  });
});
