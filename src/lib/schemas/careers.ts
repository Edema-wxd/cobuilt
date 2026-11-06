import { z } from 'zod';
import {
  APPLICATION_STATUSES,
  SALARY_PERIODS,
  VACANCY_TYPES,
  WORK_PATTERNS,
} from '../careers';
import { honeypot, isoDate, phone, queryBoolean, slug, uuid } from './common';

/**
 * Careers requests: the public vacancy reads and the application form
 * (`/api/vacancies`, `/api/careers/apply`), and the console's writes
 * (`/api/admin/careers/...`).
 */

/** A calendar date that exists: the format check alone lets 2026-02-31 through to PostgreSQL. */
const calendarDate = isoDate.refine((value) => {
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}, 'Must be a real date');

/** One entry of a responsibilities, requirements or benefits list. */
const listItem = z.string().trim().min(2).max(400);
const list = z.array(listItem).max(25);

/**
 * A published salary. Both ends are optional ("from", "up to"), but not both
 * missing: no salary is `null`, not an empty object.
 */
export const salary = z
  .object({
    min: z.number().int().positive().max(1e12).nullable(),
    max: z.number().int().positive().max(1e12).nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/, 'Must be a three-letter currency code').default('NGN'),
    period: z.enum(SALARY_PERIODS),
  })
  .strict()
  .refine((value) => value.min !== null || value.max !== null, {
    path: ['min'],
    message: 'Give at least one figure, or no salary',
  })
  .refine((value) => value.min === null || value.max === null || value.min <= value.max, {
    path: ['max'],
    message: 'Must not be below the lower figure',
  });
export type Salary = z.infer<typeof salary>;

/*
 * No `.default()` here: under `.partial()` a default would fill in a field the
 * caller left out, and an update would then overwrite it. Create applies its
 * defaults below.
 */
const vacancyBase = {
  title: z.string().trim().min(2).max(255),
  slug: slug.optional(),
  type: z.enum(VACANCY_TYPES),
  department: z.string().trim().min(2).max(120).nullable(),
  location: z.string().trim().min(2).max(160),
  workPattern: z.enum(WORK_PATTERNS).nullable(),
  summary: z.string().trim().min(10).max(400),
  description: z.string().trim().max(10_000).nullable(),
  responsibilities: list,
  requirements: list,
  benefits: list,
  salary: salary.nullable(),
  /** The last day applications are taken, WAT; null is "open until filled". */
  closingDate: calendarDate.nullable(),
  published: z.boolean(),
};

export const createVacancyBody = z
  .object({
    ...vacancyBase,
    department: vacancyBase.department.default(null),
    workPattern: vacancyBase.workPattern.default(null),
    description: vacancyBase.description.default(null),
    responsibilities: vacancyBase.responsibilities.default([]),
    requirements: vacancyBase.requirements.default([]),
    benefits: vacancyBase.benefits.default([]),
    salary: vacancyBase.salary.default(null),
    closingDate: vacancyBase.closingDate.default(null),
    // A new vacancy is a draft until someone publishes it.
    published: vacancyBase.published.default(false),
  })
  .strict();
export type CreateVacancyBody = z.infer<typeof createVacancyBody>;

export const updateVacancyBody = z
  .object(vacancyBase)
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'At least one field must be provided');
export type UpdateVacancyBody = z.infer<typeof updateVacancyBody>;

/** The whole list, in its new order. A partial list is refused rather than guessed at. */
export const reorderVacanciesBody = z
  .object({ ids: z.array(uuid).min(1).max(500) })
  .strict()
  .refine((body) => new Set(body.ids).size === body.ids.length, {
    path: ['ids'],
    message: 'Each vacancy may appear only once',
  });

export const vacancySlugQuery = z.object({ slug });

/* ---------------------------------------------------------- applications */

/** A form field left blank arrives as `''`; treat it as absent. */
const blankAsUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/**
 * The application form's text fields, as they arrive in the multipart body.
 * The CV is the one file part, and is checked on its own (src/lib/storage/cvFiles.ts);
 * these are every other part.
 */
export const applicationFields = z.object({
  /** Absent for a speculative application. */
  vacancyId: z.preprocess(blankAsUndefined, uuid.optional()),
  name: z.string({ message: 'Enter your full name' }).trim().min(2, 'Enter your full name').max(255),
  email: z
    .string({ message: 'Enter your email address' })
    .trim()
    .toLowerCase()
    .min(1, 'Enter your email address')
    .email('Enter an email address in the form name@example.com')
    .max(255),
  phone: z.preprocess(blankAsUndefined, phone.optional()),
  coverNote: z.preprocess(blankAsUndefined, z.string().trim().max(4000, 'Keep the note to 4,000 characters').optional()),
  // A checkbox sends "true" (or "on") when ticked and nothing when not.
  consent: z.enum(['true', 'on'], { message: 'Consent is required to send an application' }),
  website: honeypot,
  /** Cloudflare Turnstile's token; checked only while Turnstile is configured. */
  turnstileToken: z.string().max(4096).optional(),
});
export type ApplicationFields = z.infer<typeof applicationFields>;

export const listApplicationsQuery = z.object({
  /** A vacancy's id, or `speculative` for applications to no vacancy. */
  vacancy: z.union([uuid, z.literal('speculative')]).optional(),
  status: z.enum(APPLICATION_STATUSES).optional(),
  flaggedAsSpam: queryBoolean.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListApplicationsQuery = z.infer<typeof listApplicationsQuery>;

export const updateApplicationBody = z
  .object({
    status: z.enum(APPLICATION_STATUSES),
    /** For the hiring team only; null clears them. */
    staffNotes: z.string().trim().max(5000).nullable(),
    flaggedAsSpam: z.boolean(),
  })
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'At least one field must be provided');
export type UpdateApplicationBody = z.infer<typeof updateApplicationBody>;
