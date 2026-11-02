import { pathOnly } from '@/lib/http/request';

describe('pathOnly', () => {
  it('drops the query string, which can carry single-use tokens', () => {
    expect(pathOnly('/api/forms/newsletter/confirm?token=secret')).toBe(
      '/api/forms/newsletter/confirm',
    );
    expect(pathOnly('/api/projects')).toBe('/api/projects');
    expect(pathOnly(undefined)).toBeUndefined();
  });
});
