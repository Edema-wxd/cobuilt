import { sanitiseUrl } from '../../components/pageViews';

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
    expect(sanitiseUrl('/projects', 'https://cobuilt.com')).toBe('https://cobuilt.com/projects');
  });

  it('rejects anything that is not an http(s) URL', () => {
    expect(sanitiseUrl('javascript:alert(1)')).toBeUndefined();
    expect(sanitiseUrl('not a url')).toBeUndefined();
  });

  it('caps length at what the endpoint accepts', () => {
    expect(sanitiseUrl(`https://cobuilt.com/${'a'.repeat(600)}`)).toHaveLength(512);
  });
});
