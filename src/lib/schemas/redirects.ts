import { z } from 'zod';
import { checkDestination, checkSource, type CheckedDestination } from '../redirectPaths';

/**
 * Redirect requests — `/api/admin/redirects`. The path rules live in
 * src/lib/redirectPaths.ts, which the console's form shares; here they become
 * a 422 naming the field. The source arrives normalised (`/About-Us/` is
 * stored as `/about-us`), and the destination carries the path it lands on
 * here, which is what the repository's loop check compares.
 */

const sourcePath = z.string().transform((value, ctx): string => {
  const checked = checkSource(value);
  if (!checked.ok) {
    ctx.addIssue({ code: 'custom', message: checked.message });
    return z.NEVER;
  }
  return checked.value;
});

const destination = z.string().transform((value, ctx): CheckedDestination => {
  const checked = checkDestination(value);
  if (!checked.ok) {
    ctx.addIssue({ code: 'custom', message: checked.message });
    return z.NEVER;
  }
  return checked.value;
});

/** Not to itself: the one loop a single rule can make. */
function notToItself(body: { sourcePath?: string; destination?: CheckedDestination }): boolean {
  return !body.sourcePath || !body.destination || body.destination.sitePath !== body.sourcePath;
}
const TO_ITSELF = { path: ['destination'], message: 'A path cannot redirect to itself' };

export const createRedirectBody = z
  .object({
    sourcePath,
    destination,
    /** 308 when true (the default: an address that has moved for good), 307 when false. */
    permanent: z.boolean().default(true),
  })
  .strict()
  .refine(notToItself, TO_ITSELF);
export type CreateRedirectBody = z.infer<typeof createRedirectBody>;

export const updateRedirectBody = z
  .object({ sourcePath, destination, permanent: z.boolean() })
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'At least one field must be provided')
  .refine(notToItself, TO_ITSELF);
export type UpdateRedirectBody = z.infer<typeof updateRedirectBody>;
