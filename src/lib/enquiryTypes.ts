/**
 * What an enquiry is about, chosen on the contact form. Stored with the
 * submission (`metadata.enquiryType`) so partnership, media and supplier
 * enquiries can be told apart in the inbox and the staff email without
 * reading each one.
 *
 * Kept apart from src/lib/schemas/forms.ts, which re-exports them, so the
 * contact form and the console can name them without bundling Zod.
 */

export const ENQUIRY_TYPES = [
  'general',
  'project',
  'partnership',
  'suppliers',
  'media',
  'careers',
  'project_record',
] as const;
export type EnquiryType = (typeof ENQUIRY_TYPES)[number];

/** In the order the contact form lists them. */
export const ENQUIRY_TYPE_LABELS: Record<EnquiryType, string> = {
  general: 'General enquiry',
  project: 'New project or development',
  partnership: 'Partnership or joint venture',
  suppliers: 'Contractors and suppliers',
  media: 'Media and press',
  careers: 'Careers',
  project_record: 'A question about a project record',
};

export function isEnquiryType(value: unknown): value is EnquiryType {
  return typeof value === 'string' && (ENQUIRY_TYPES as readonly string[]).includes(value);
}

/** The label for a stored value; a submission from before the field reads as general. */
export function enquiryTypeLabel(value: unknown): string {
  return ENQUIRY_TYPE_LABELS[isEnquiryType(value) ? value : 'general'];
}
