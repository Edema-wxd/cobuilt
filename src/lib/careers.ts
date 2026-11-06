/**
 * Careers vocabulary (db/migrations/0022): vacancy types, work patterns,
 * application statuses and the CV rules.
 *
 * No imports, so the public pages, the console's client code and the API
 * share one list without bundling Zod (as src/lib/documentCategories.ts).
 */

/** In the order /careers groups them: the standing roles first, then the two programmes. */
export const VACANCY_TYPES = ['full_time', 'part_time', 'contract', 'graduate', 'internship'] as const;
export type VacancyType = (typeof VACANCY_TYPES)[number];

export const VACANCY_TYPE_LABELS: Record<VacancyType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  graduate: 'Graduate programme',
  internship: 'Internship',
};

export const WORK_PATTERNS = ['on_site', 'hybrid', 'remote'] as const;
export type WorkPattern = (typeof WORK_PATTERNS)[number];

export const WORK_PATTERN_LABELS: Record<WorkPattern, string> = {
  on_site: 'On site',
  hybrid: 'Hybrid',
  remote: 'Remote',
};

export const SALARY_PERIODS = ['year', 'month'] as const;
export type SalaryPeriod = (typeof SALARY_PERIODS)[number];

/** Where an application is in the hiring team's process. Staff-only; the applicant never sees it. */
export const APPLICATION_STATUSES = ['new', 'reviewing', 'shortlisted', 'rejected', 'hired'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: 'New',
  reviewing: 'Reviewing',
  shortlisted: 'Shortlisted',
  rejected: 'Not progressing',
  hired: 'Hired',
};

/**
 * The largest CV accepted: 4 MB. Not 5: Vercel refuses a request body over
 * 4.5 MB before the function runs, and the CV arrives inside the form's own
 * request (docs/decisions.md §2.28). A CV is rarely over 1 MB.
 */
export const MAX_CV_BYTES = 4 * 1024 * 1024;

export const CV_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
} as const;
export type CvExtension = keyof typeof CV_TYPES;

/** For the file input's `accept`: a hint to the picker, not the check. */
export const CV_ACCEPT = `.pdf,.docx,${CV_TYPES.pdf},${CV_TYPES.docx}`;

/** Today's date in West Africa Time, as YYYY-MM-DD: closing dates are the office's days. */
export function lagosToday(now: Date = new Date()): string {
  // UTC+1 all year; no daylight saving to account for.
  return new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** A vacancy takes applications through the whole of its closing day, WAT. */
export function isOpen(closingDate: string | null, now: Date = new Date()): boolean {
  return closingDate === null || closingDate >= lagosToday(now);
}

/** "12 December 2026", from a YYYY-MM-DD date, read as a calendar day (§2.11). */
export function formatClosingDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

/** "₦450,000–₦600,000 a month", or null when the vacancy names no salary. */
export function salaryText(salary: {
  min: number | null;
  max: number | null;
  currency: string;
  period: SalaryPeriod;
} | null): string | null {
  if (!salary || (salary.min === null && salary.max === null)) return null;
  const money = (value: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: salary.currency, maximumFractionDigits: 0 }).format(value);
  const per = salary.period === 'year' ? 'a year' : 'a month';
  if (salary.min !== null && salary.max !== null && salary.min !== salary.max) {
    return `${money(salary.min)}–${money(salary.max)} ${per}`;
  }
  if (salary.min !== null && salary.max === null) return `From ${money(salary.min)} ${per}`;
  if (salary.min === null && salary.max !== null) return `Up to ${money(salary.max)} ${per}`;
  return `${money(salary.min ?? salary.max!)} ${per}`;
}
