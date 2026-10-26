import { pathOf, sanitiseUrl, trackingAllowed } from '@/lib/client/pageViews';
import { phoneVariants } from '@/lib/repositories/dataSubjects';

describe('page view URLs', () => {
  it('drops query strings and fragments, which can carry tokens', () => {
    expect(sanitiseUrl('https://cobuilt.com/api/forms/newsletter/confirm?token=abc#x')).toBe(
      'https://cobuilt.com/api/forms/newsletter/confirm',
    );
    expect(sanitiseUrl('https://www.google.com/search?q=ada+obi+phone')).toBe(
      'https://www.google.com/search',
    );
  });

  it('resolves a path against the site origin', () => {
    expect(sanitiseUrl('/privacy', 'https://cobuilt.com')).toBe('https://cobuilt.com/privacy');
    expect(pathOf('/terms?from=footer#law', 'https://cobuilt.com')).toBe('/terms');
  });

  it('rejects anything that is not an http(s) URL', () => {
    expect(sanitiseUrl('javascript:alert(1)')).toBeUndefined();
    expect(sanitiseUrl('not a url')).toBeUndefined();
  });

  it('caps length at what the endpoint accepts', () => {
    expect(sanitiseUrl(`https://cobuilt.com/${'a'.repeat(600)}`)).toHaveLength(512);
  });
});

describe('tracking consent signals', () => {
  it('honours Do Not Track and Global Privacy Control', () => {
    expect(trackingAllowed({ doNotTrack: '1' })).toBe(false);
    expect(trackingAllowed({ globalPrivacyControl: true } as { doNotTrack?: string })).toBe(false);
    expect(trackingAllowed({ doNotTrack: null })).toBe(true);
    expect(trackingAllowed({})).toBe(true);
  });
});

describe('phone matching for data subject requests', () => {
  it('matches Nigerian numbers in local and international form', () => {
    expect(phoneVariants('0801 234 5678')).toEqual(['08012345678', '2348012345678']);
    expect(phoneVariants('+234 (801) 234-5678')).toEqual(['2348012345678', '08012345678']);
  });

  it('leaves other numbers as digits only', () => {
    expect(phoneVariants('+44 20 7946 0958')).toEqual(['442079460958']);
    expect(phoneVariants(undefined)).toEqual([]);
    expect(phoneVariants('---')).toEqual([]);
  });
});
