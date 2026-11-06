import type { Metadata } from 'next';
import VacancyEditor from '../vacancy-editor';

export const metadata: Metadata = { title: 'Add a vacancy' };

export default function NewVacancyPage() {
  return <VacancyEditor vacancyId={null} />;
}
