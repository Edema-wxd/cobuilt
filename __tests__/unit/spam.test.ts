import { heuristicScore } from '@/lib/spam';
import { inquiryBody } from '@/lib/schemas/forms';

const baseline = {
  name: 'Adaeze Okafor',
  email: 'adaeze@example.com',
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
};

describe('spam heuristics', () => {
  it('treats a filled honeypot as conclusive', () => {
    const result = heuristicScore({ ...baseline, content: 'Hello', honeypot: 'http://spam' });
    expect(result.isSpam).toBe(true);
    expect(result.score).toBe(1);
    expect(result.reasons).toEqual(['honeypot']);
  });

  it('passes a genuine enquiry', () => {
    const result = heuristicScore({
      ...baseline,
      content:
        'Hello, I would like to discuss the Ocean Ridge development and whether units remain available for a family purchase this year.',
    });
    expect(result.isSpam).toBe(false);
    expect(result.score).toBeLessThan(0.7);
  });

  it('flags link-stuffed marketing copy', () => {
    const result = heuristicScore({
      ...baseline,
      content:
        'seo services and backlink packages https://a.co https://b.co https://c.co https://d.co https://e.co',
    });
    expect(result.isSpam).toBe(true);
    expect(result.reasons.some((r) => r.startsWith('links:'))).toBe(true);
  });

  it('penalises a missing user agent', () => {
    const withAgent = heuristicScore({ ...baseline, content: 'A perfectly ordinary message here.' });
    const without = heuristicScore({
      ...baseline,
      userAgent: null,
      content: 'A perfectly ordinary message here.',
    });
    expect(without.score).toBeGreaterThan(withAgent.score);
    expect(without.reasons).toContain('missing-user-agent');
  });

  it('keeps the score within the numeric(3,2) column range', () => {
    const result = heuristicScore({
      name: 'ВАСИЛИЙ',
      email: 'x@y.z',
      userAgent: null,
      content: 'CASINO VIAGRA LOAN OFFER https://a.co https://b.co https://c.co https://d.co https://e.co BACKLINK',
    });
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

describe('honeypot handling', () => {
  it('accepts a filled honeypot at the schema layer', () => {
    // Rejecting it in validation would return a 422 naming the field, which
    // tells a bot author which input is the trap. The spam check catches it
    // instead, and the caller gets an ordinary success response.
    const result = inquiryBody.safeParse({
      name: 'Bot',
      email: 'bot@spam.example',
      message: 'buy backlinks now, click here',
      consent: true,
      website: 'http://spam.example',
    });

    expect(result.success).toBe(true);
  });
});
