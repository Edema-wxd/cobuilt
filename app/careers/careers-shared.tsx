import { cardBody, uppercaseLink } from '../../components/sections';
import {
  VACANCY_TYPE_LABELS,
  WORK_PATTERN_LABELS,
  formatClosingDate,
  salaryText,
} from '@/lib/careers';
import type { PublicVacancy } from './load-careers';

/** "Full-time · Lagos · Hybrid": what a vacancy is, in one line. */
export function vacancyFacts(vacancy: PublicVacancy): string {
  return [
    VACANCY_TYPE_LABELS[vacancy.type],
    vacancy.location,
    vacancy.workPattern ? WORK_PATTERN_LABELS[vacancy.workPattern] : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** "Closes 12 December 2026", or "Open until filled". */
export function closingText(vacancy: Pick<PublicVacancy, 'closingDate'>): string {
  return vacancy.closingDate ? `Closes ${formatClosingDate(vacancy.closingDate)}` : 'Open until filled';
}

/** One vacancy in a list on /careers: the facts, the summary, and the way in. */
export function VacancyCard({ vacancy }: { vacancy: PublicVacancy }) {
  const salary = salaryText(vacancy.salary);
  return (
    <li className="flex flex-col gap-3 bg-white p-6 sm:p-7.5">
      {vacancy.department ? (
        <p className="text-[0.688rem] font-semibold tracking-[0.14em] text-zinc-600 uppercase">{vacancy.department}</p>
      ) : null}
      <h4 className="text-[1.125rem] leading-[1.35] font-semibold break-words text-ink">
        <a className="hover:text-rust" href={`/careers/${vacancy.slug}`}>
          {vacancy.title}
        </a>
      </h4>
      <p className="font-mono text-[0.75rem] tracking-[0.04em] text-zinc-600">
        {vacancyFacts(vacancy)}
        {salary ? ` · ${salary}` : ''}
      </p>
      <p className={cardBody}>{vacancy.summary}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-1 pt-2">
        <p className="font-mono text-[0.75rem] tracking-[0.04em] text-zinc-700">{closingText(vacancy)}</p>
        <a
          className={`${uppercaseLink} inline-flex min-h-target items-center text-[0.719rem]`}
          href={`/careers/${vacancy.slug}#apply`}
        >
          View and apply<span className="sr-only">: {vacancy.title}</span> →
        </a>
      </div>
    </li>
  );
}

/** A grid of vacancy cards, divided by hairlines over a grey ground. */
export function VacancyList({ vacancies, columns = 2 }: { vacancies: PublicVacancy[]; columns?: 1 | 2 }) {
  return (
    // An odd last card spans the row, so the grey ground never shows as a gap.
    <ul
      className={`reveal grid grid-cols-1 gap-px border border-zinc-300 bg-zinc-300 ${
        columns === 2 ? 'md:grid-cols-2 md:[&>li:last-child:nth-child(odd)]:col-span-2' : ''
      }`}
    >
      {vacancies.map((vacancy) => (
        <VacancyCard key={vacancy.id} vacancy={vacancy} />
      ))}
    </ul>
  );
}
