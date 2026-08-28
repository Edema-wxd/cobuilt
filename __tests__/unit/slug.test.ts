import { slugify } from '@/lib/slug';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Ocean Ridge Residences')).toBe('ocean-ridge-residences');
  });

  it('strips accents so equivalent names produce one slug', () => {
    expect(slugify('Lékki Phase 1')).toBe('lekki-phase-1');
  });

  it('drops apostrophes rather than turning them into separators', () => {
    expect(slugify("Kings' Court")).toBe('kings-court');
    expect(slugify('Kings’ Court')).toBe('kings-court');
  });

  it('collapses punctuation runs and trims the edges', () => {
    expect(slugify('  --Mixed // Use--  ')).toBe('mixed-use');
  });

  it('never exceeds the column length', () => {
    expect(slugify('a'.repeat(400)).length).toBeLessThanOrEqual(200);
  });

  it('returns an empty string for input with no slug-able characters', () => {
    expect(slugify('!!!')).toBe('');
  });
});
