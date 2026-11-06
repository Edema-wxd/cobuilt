import type { Metadata } from 'next';
import VacancyEditor from '../vacancy-editor';

export const metadata: Metadata = { title: 'Edit vacancy' };

export default async function EditVacancyPage({ params }: { params: Promise<{ vacancyId: string }> }) {
  const { vacancyId } = await params;
  return <VacancyEditor vacancyId={vacancyId} />;
}
