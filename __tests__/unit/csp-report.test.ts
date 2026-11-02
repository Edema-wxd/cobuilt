import { parseReports } from '../../pages/api/csp-report';

describe('CSP violation reports', () => {
  it('reads the legacy report-uri shape, keeping only origins and paths', () => {
    const raw = JSON.stringify({
      'csp-report': {
        'document-uri': 'https://cobuilt.com/api/forms/newsletter/confirm?token=secret',
        'violated-directive': 'script-src-elem',
        'blocked-uri': 'https://evil.example/x.js?id=1',
        disposition: 'report',
      },
    });

    expect(parseReports(raw)).toEqual([
      {
        directive: 'script-src-elem',
        blocked: 'https://evil.example',
        page: '/api/forms/newsletter/confirm',
        disposition: 'report',
      },
    ]);
  });

  it('reads the Reporting API shape and ignores other report types', () => {
    const raw = JSON.stringify([
      {
        type: 'csp-violation',
        body: {
          documentURL: 'https://cobuilt.com/contact',
          effectiveDirective: 'frame-src',
          blockedURL: 'inline',
          disposition: 'report',
        },
      },
      { type: 'deprecation', body: { message: 'x' } },
    ]);

    expect(parseReports(raw)).toEqual([
      { directive: 'frame-src', blocked: 'inline', page: '/contact', disposition: 'report' },
    ]);
  });
});
