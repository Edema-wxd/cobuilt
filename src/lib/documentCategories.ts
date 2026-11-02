/**
 * The download centre's categories (db/migrations/0021, `documents_category_valid`).
 *
 * Kept apart from src/lib/schemas/documents.ts, which re-exports them, so the
 * console's client code can name them without bundling Zod.
 */

export const DOCUMENT_CATEGORIES = [
  'company_profile',
  'capability_statement',
  'brochure',
  'project_profile',
  'policy',
  'other',
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/** Singular labels, for a document's own category. */
export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  company_profile: 'Company profile',
  capability_statement: 'Capability statement',
  brochure: 'Brochure',
  project_profile: 'Project profile',
  policy: 'Policy',
  other: 'Other',
};
