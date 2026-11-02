import { fileFacts } from '../../../components/documents';

/**
 * A project's published downloads — its project profile and anything else
 * attached to it at `/admin/downloads` — listed under the hero's actions,
 * beside the brochure button. Each link is the counted download endpoint
 * (docs/decisions.md §2.25), and says the file's type and size. Renders
 * nothing when there are none.
 */

export interface ProjectDocument {
  id: string;
  title: string;
  fileType: string | null;
  fileSizeBytes: number | null;
  downloadUrl: string;
}

export default function ProjectDocuments({ documents }: { documents: ProjectDocument[] }) {
  if (documents.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 border-t border-line-on-dark pt-4">
      <p className="text-[0.656rem] font-semibold tracking-[0.18em] text-zinc-400 uppercase" id="project-downloads">
        Downloads
      </p>
      <ul className="flex flex-col" aria-labelledby="project-downloads">
        {documents.map((document) => (
          <li key={document.id}>
            <a
              className="group inline-flex min-h-target flex-wrap items-baseline gap-x-3 py-1.5 text-[0.906rem] text-white"
              href={document.downloadUrl}
              rel="nofollow"
            >
              <span className="underline decoration-zinc-500 underline-offset-4 group-hover:decoration-orange-on-dark">
                {document.title}
              </span>
              <span className="font-mono text-[0.75rem] tracking-[0.04em] text-zinc-400">
                {fileFacts(document.fileType, document.fileSizeBytes)}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
