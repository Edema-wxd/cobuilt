import { unzipSync } from 'fflate';
import { CV_TYPES, MAX_CV_BYTES, type CvExtension } from '../careers';

/**
 * Checks a CV sent with an application (docs/decisions.md §2.28).
 *
 * The browser's own claim about a file — its name and `type` — is a hint, not
 * evidence: a renamed executable says `application/pdf` as readily as a CV
 * does. So a file is accepted only when its name ends .pdf or .docx *and* its
 * bytes are that format: a PDF starts `%PDF-`, and a DOCX is a ZIP archive
 * holding `[Content_Types].xml` and `word/document.xml`. The stored type is
 * the one detected here. Nothing is ever opened, rendered or executed; the
 * archive's directory is read and its contents are not decompressed.
 */

export interface CheckedCv {
  /** Safe to put in a Content-Disposition header and show in the console. */
  fileName: string;
  contentType: (typeof CV_TYPES)[CvExtension];
  sizeBytes: number;
}

export type CvCheck = { ok: true; cv: CheckedCv } | { ok: false; message: string };

const PDF_MAGIC = Buffer.from('%PDF-');
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/** The parts a Word document cannot be without. */
const DOCX_PARTS = ['[Content_Types].xml', 'word/document.xml'];

/**
 * The name as stored: the last path segment, control characters and quotes
 * removed, whitespace collapsed, at most 120 characters with the extension
 * kept. A name that is nothing after that becomes "cv.pdf".
 */
export function safeFileName(name: string, extension: CvExtension): string {
  const base = (name.split(/[\\/]/).pop() ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f"<>|*?:]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.[a-z0-9]{1,5}$/i, '');
  const stem = base.slice(0, 110).trim() || 'cv';
  return `${stem}.${extension}`;
}

function extensionOf(name: string): CvExtension | null {
  const extension = name.split('.').pop()?.toLowerCase();
  return extension === 'pdf' || extension === 'docx' ? extension : null;
}

function isDocx(bytes: Uint8Array): boolean {
  const names = new Set<string>();
  try {
    // The filter sees each entry's name and declines to extract it, so only
    // the central directory is read.
    unzipSync(bytes, {
      filter: (file) => {
        names.add(file.name);
        return false;
      },
    });
  } catch {
    return false;
  }
  return DOCX_PARTS.every((part) => names.has(part));
}

export function checkCv(file: { name: string; bytes: Uint8Array }): CvCheck {
  const { name, bytes } = file;

  if (bytes.byteLength === 0) return { ok: false, message: 'The CV file is empty. Choose the file again.' };
  if (bytes.byteLength > MAX_CV_BYTES) {
    return { ok: false, message: `The CV must be ${MAX_CV_BYTES / 1024 / 1024} MB or smaller.` };
  }

  const extension = extensionOf(name);
  if (!extension) return { ok: false, message: 'The CV must be a PDF or a Word (.docx) document.' };

  const head = Buffer.from(bytes.subarray(0, 8));
  const matches =
    extension === 'pdf'
      ? head.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)
      : head.subarray(0, ZIP_MAGIC.length).equals(ZIP_MAGIC) && isDocx(bytes);
  if (!matches) {
    return {
      ok: false,
      message: `That file is not a readable ${extension === 'pdf' ? 'PDF' : 'Word document'}. Save it again as a PDF or .docx and try once more.`,
    };
  }

  return {
    ok: true,
    cv: { fileName: safeFileName(name, extension), contentType: CV_TYPES[extension], sizeBytes: bytes.byteLength },
  };
}

/**
 * `Content-Disposition` for a CV download: an ASCII fallback name plus the
 * exact name in RFC 5987 form, always as an attachment so a browser saves it
 * rather than rendering it on this origin.
 */
export function attachmentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  // encodeURIComponent leaves ' ( ) * ! as they are; RFC 5987 does not allow them unencoded.
  const encoded = encodeURIComponent(fileName).replace(
    /['()*!]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
