import { ApiError, badRequest, notFound, serviceUnavailable, validationFailed } from '@/lib/http/errors';
import { createRoute, created, formatZodIssues } from '@/lib/http/route';
import { header } from '@/lib/http/request';
import { fileField, readMultipart, textField } from '@/lib/http/multipart';
import { RATE_LIMITS } from '@/lib/rateLimit';
import { env } from '@/lib/env';
import { checkSpam } from '@/lib/spam';
import { CAREERS_ACTION, isTurnstileEnabled, verifyTurnstile } from '@/lib/turnstile';
import { formatClosingDate, MAX_CV_BYTES } from '@/lib/careers';
import { applicationFields } from '@/lib/schemas/careers';
import { checkCv } from '@/lib/storage/cvFiles';
import * as vacancies from '@/lib/repositories/vacancies';
import * as jobApplications from '@/lib/repositories/jobApplications';
import { enqueueEmail } from '@/lib/queues';

/**
 * POST /api/careers/apply — the job application form (docs/decisions.md §2.28).
 *
 * `multipart/form-data`: the fields of `applicationFields` and one file part,
 * `cv`, a PDF or DOCX of up to 4 MB. With `vacancyId` it is an application for
 * that vacancy, which must be published and not past its closing date; without
 * it, a speculative application.
 *
 * The contact form's order of operations, with the CV in it: the rate limit
 * (before the body is read, so a flood of uploads is refused cheaply), then
 * the fields and the CV are validated together, so the form can show every
 * problem at once; then Turnstile, when configured, fails closed; then the
 * spam score; then the application and its CV are stored in one transaction;
 * then the two emails are queued. Neither email carries the CV.
 *
 * A filled honeypot stores nothing — a bot's CV is not something to keep — and
 * gets the same answer as a real application. Anything else the spam checks
 * flag is stored for review, unannounced, as the contact form does.
 */

// The CV is read from the raw body; Next.js's JSON parser would refuse it.
export const config = { api: { bodyParser: false } };

/** The CV plus the form's text fields and multipart framing. */
const MAX_REQUEST_BYTES = MAX_CV_BYTES + 64 * 1024;

/** The fields read from the form; anything else in it is ignored. */
const FIELDS = ['vacancyId', 'name', 'email', 'phone', 'coverNote', 'consent', 'website', 'turnstileToken'] as const;

/** Who hears about a new application: CAREERS_EMAIL, comma-separated, else the admin inbox. */
function hiringTeam(): string[] {
  const list = (env.CAREERS_EMAIL ?? '')
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean);
  return list.length > 0 ? list : [env.ADMIN_EMAIL];
}

export default createRoute({
  POST: {
    rateLimit: RATE_LIMITS.application,
    // Public endpoint, no session to protect; the honeypot, the CAPTCHA and
    // the rate limit are the abuse controls here.
    csrf: false,
    handler: async ({ req, ip, userAgent }) => {
      const form = await readMultipart(req, MAX_REQUEST_BYTES);

      const raw: Record<string, string> = {};
      for (const name of FIELDS) {
        const value = textField(form, name);
        if (value !== undefined) raw[name] = value;
      }
      const fields = applicationFields.safeParse(raw);

      const file = fileField(form, 'cv');
      const bytes = file ? new Uint8Array(await file.arrayBuffer()) : null;
      const cv =
        file && bytes
          ? checkCv({ name: file.name, bytes })
          : ({ ok: false, message: 'Attach your CV, as a PDF or a Word (.docx) document.' } as const);

      if (!fields.success || !cv.ok) {
        throw validationFailed(
          [
            ...(fields.success ? [] : formatZodIssues(fields.error)),
            ...(cv.ok ? [] : [{ field: 'cv', message: cv.message }]),
          ],
          'Invalid request body',
        );
      }
      const body = fields.data;

      if (isTurnstileEnabled()) {
        if (!body.turnstileToken) {
          throw validationFailed(
            [{ field: 'turnstileToken', message: 'Complete the check that you are not a robot, then send again' }],
            'Invalid request body',
          );
        }
        const check = await verifyTurnstile(body.turnstileToken, ip, CAREERS_ACTION);
        if (!check.ok && check.reason === 'unavailable') {
          throw serviceUnavailable('The anti-spam check could not be completed. Try again shortly');
        }
        if (!check.ok) {
          throw badRequest('The anti-spam check failed. Try it again, then send', [
            { field: 'turnstileToken', message: 'The check was not accepted' },
          ]);
        }
      }

      let vacancyTitle: string | null = null;
      if (body.vacancyId) {
        const vacancy = await vacancies.findForApplication(body.vacancyId);
        if (!vacancy) throw notFound('This vacancy is not open for applications');
        if (!vacancy.isOpen) {
          throw new ApiError(
            409,
            'conflict',
            `Applications for this vacancy closed on ${formatClosingDate(vacancy.closingDate!)}. You can still send a speculative application`,
          );
        }
        vacancyTitle = vacancy.title;
      }

      const spam = await checkSpam({
        name: body.name,
        email: body.email,
        content: body.coverNote ?? null,
        ip,
        userAgent,
        referrer: header(req, 'referer'),
        honeypot: body.website,
      });

      // A bot: nothing is kept, and the answer is the one a person gets.
      if (spam.reasons.includes('honeypot')) return created({ success: true });

      const application = await jobApplications.create({
        vacancyId: body.vacancyId ?? null,
        name: body.name,
        email: body.email,
        phone: body.phone ?? null,
        coverNote: body.coverNote ?? null,
        cv: { ...cv.cv, bytes: bytes! },
        spamScore: spam.score,
        flaggedAsSpam: spam.isSpam,
      });

      // Flagged applications wait in the inbox's spam view; nobody is emailed.
      if (spam.isSpam) return created({ success: true });

      await Promise.all([
        enqueueEmail({
          type: 'application-confirmation',
          to: body.email,
          payload: { name: body.name, vacancyTitle },
        }),
        ...hiringTeam().map((to) =>
          enqueueEmail({
            type: 'application-notification',
            to,
            payload: { applicationId: application.id, name: body.name, vacancyTitle },
          }),
        ),
      ]);

      return created({ success: true });
    },
  },
});
