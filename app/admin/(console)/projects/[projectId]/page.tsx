import type { Metadata } from 'next';
import ProjectEditor from '../project-editor';

export const metadata: Metadata = { title: 'Edit project' };

export default async function EditProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectEditor projectId={projectId} />;
}
