import { z } from 'zod';
import { email, honeypot, phone, uuid } from './common';

/**
 * Public form payloads. Every one carries a honeypot; the investment form also
 * requires explicit consent, which NDPA requires before storing contact data
 * for a follow-up (§11).
 */

export const inquiryBody = z.object({
  name: z.string().trim().min(2).max(255),
  email,
  phone: phone.optional(),
  subject: z.string().trim().max(255).optional(),
  message: z.string().trim().min(10).max(5000),
  projectId: uuid.optional(),
  consent: z.literal(true, { message: 'Consent is required to submit this form' }),
  website: honeypot,
});
export type InquiryBody = z.infer<typeof inquiryBody>;

export const newsletterBody = z.object({
  email,
  fullName: z.string().trim().max(255).optional(),
  source: z.string().trim().max(100).optional(),
  website: honeypot,
});
export type NewsletterBody = z.infer<typeof newsletterBody>;

export const newsletterConfirmQuery = z.object({
  token: z.string().min(16).max(128),
});

export const newsletterUnsubscribeBody = z.object({
  token: z.string().min(16).max(128),
});

export const investmentBody = z.object({
  name: z.string().trim().min(2).max(255),
  email,
  phone: phone.optional(),
  companyName: z.string().trim().max(255).optional(),
  investmentRange: z
    .enum(['under_50m', '50m_250m', '250m_1b', 'above_1b', 'undisclosed'])
    .optional(),
  projectId: uuid.optional(),
  message: z.string().trim().min(10).max(5000),
  consent: z.literal(true, { message: 'Consent is required to submit this form' }),
  website: honeypot,
});
export type InvestmentBody = z.infer<typeof investmentBody>;

export const listSubmissionsQuery = z.object({
  formType: z.enum(['inquiry', 'newsletter', 'investment']).optional(),
  flaggedAsSpam: z.coerce.boolean().optional(),
  processed: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
