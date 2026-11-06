import type { Metadata } from 'next';
import VacancyList from './vacancy-list';

export const metadata: Metadata = { title: 'Vacancies' };

export default function CareersPage() {
  return <VacancyList />;
}
