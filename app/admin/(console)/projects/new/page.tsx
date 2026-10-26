import type { Metadata } from 'next';
import ProjectEditor from '../project-editor';

export const metadata: Metadata = { title: 'New project' };

export default function NewProjectPage() {
  return <ProjectEditor projectId={null} />;
}
