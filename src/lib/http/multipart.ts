import type { NextApiRequest } from 'next';
import { ApiError, badRequest, payloadTooLarge } from './errors';
import { header } from './request';

/**
 * Reads a `multipart/form-data` body — the job application form, which sends
 * a CV with its fields (docs/decisions.md §2.28).
 *
 * The route must disable Next.js's body parser:
 *   export const config = { api: { bodyParser: false } };
 *
 * The body is read with a hard ceiling, refused early from its declared length
 * and again partway through if it runs past it, so an oversized upload is cut
 * off rather than buffered whole. Parsing is the runtime's own (the Fetch
 * API's `formData()`), so no multipart library is added.
 */

export async function readMultipart(req: NextApiRequest, maxBytes: number): Promise<FormData> {
  const contentType = header(req, 'content-type') ?? '';
  if (!/^multipart\/form-data;\s*boundary=/i.test(contentType)) {
    throw new ApiError(415, 'unsupported_media_type', 'Send the form as multipart/form-data');
  }

  const declared = Number(header(req, 'content-length') ?? NaN);
  if (Number.isFinite(declared) && declared > maxBytes) throw tooLarge(maxBytes);

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    total += buffer.length;
    if (total > maxBytes) throw tooLarge(maxBytes);
    chunks.push(buffer);
  }

  try {
    return await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': contentType } }).formData();
  } catch {
    throw badRequest('The form could not be read. Reload the page and send it again');
  }
}

function tooLarge(maxBytes: number): ApiError {
  return payloadTooLarge(`The form is larger than ${Math.floor(maxBytes / 1024 / 1024)} MB. Attach a smaller CV`);
}

/** A text field's value, or undefined when it is absent or is a file. */
export function textField(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === 'string' ? value : undefined;
}

/** A file field's value, or null when it is absent, empty-named or not a file. */
export function fileField(form: FormData, name: string): File | null {
  const value = form.get(name);
  return value !== null && typeof value !== 'string' && value.name ? value : null;
}
