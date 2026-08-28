import { z } from 'zod';

/** Building blocks shared by every request schema. */

export const uuid = z.string().uuid('Must be a valid UUID');

export const slug = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be lowercase alphanumeric words separated by hyphens');

export const email = z.string().trim().toLowerCase().email('Must be a valid email address').max(255);

/**
 * Nigerian and international numbers, stored as entered but constrained to
 * digits, spaces and the usual separators so the column cannot become a free
 * text field.
 */
export const phone = z
  .string()
  .trim()
  .min(7)
  .max(20)
  .regex(/^\+?[0-9][0-9\s\-()]{5,19}$/, 'Must be a valid phone number');

export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

export const httpUrl = z.string().url().max(512).refine(
  (value) => value.startsWith('https://') || value.startsWith('http://'),
  'Must be an http(s) URL',
);

/** Accepts `a,b,c` or a repeated query param and yields a string array. */
export const csvList = z
  .union([z.string(), z.array(z.string())])
  .transform((value) =>
    (Array.isArray(value) ? value : value.split(','))
      .map((v) => v.trim())
      .filter(Boolean),
  );

/**
 * Honeypot field: a hidden input real users never fill.
 *
 * Deliberately permissive. Rejecting a filled honeypot here would return a 422
 * naming the field, which tells a bot author exactly which input is the trap.
 * The value is passed to the spam check instead, and a filled honeypot yields
 * the same success response a genuine submission gets.
 */
export const honeypot = z.string().max(500).optional();

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be an ISO date (YYYY-MM-DD)');
