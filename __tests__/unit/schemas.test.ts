import { queryBoolean } from '@/lib/schemas/common';
import { listSubmissionsQuery } from '@/lib/schemas/forms';

/**
 * Query strings arrive as text, so "false" is a non-empty string. These pin the
 * behaviour that `z.coerce.boolean()` got wrong.
 */

describe('queryBoolean', () => {
  it.each([
    ['true', true],
    ['1', true],
    [true, true],
    ['false', false],
    ['0', false],
    [false, false],
  ])('reads %p as %p', (input, expected) => {
    expect(queryBoolean.parse(input)).toBe(expected);
  });

  it('rejects anything else rather than guessing', () => {
    expect(queryBoolean.safeParse('yes').success).toBe(false);
    expect(queryBoolean.safeParse('').success).toBe(false);
  });

  it('lets the admin inbox ask for submissions that are not spam', () => {
    const query = listSubmissionsQuery.parse({ flaggedAsSpam: 'false' });
    expect(query.flaggedAsSpam).toBe(false);
  });

  it('leaves an absent filter unset', () => {
    expect(listSubmissionsQuery.parse({}).flaggedAsSpam).toBeUndefined();
  });
});
