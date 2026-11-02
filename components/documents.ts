/**
 * How a downloadable document's file is described wherever it is listed —
 * `/resources` and a project's downloads — so a visitor knows what they are
 * about to fetch before they fetch it (docs/design-handover.md, `/downloads`:
 * "a file list pattern with type and size").
 */

/** "PDF", or "Link" when the file's type is not known. */
export function fileTypeLabel(fileType: string | null): string {
  return fileType ? fileType.toUpperCase() : 'Link';
}

/** "840 KB", "2.4 MB"; null when the size is not known (a linked file). */
export function formatFileSize(bytes: number | null): string | null {
  if (bytes === null || bytes <= 0) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** "PDF · 2.4 MB", or "PDF" alone when the size is not known. */
export function fileFacts(fileType: string | null, fileSizeBytes: number | null): string {
  const size = formatFileSize(fileSizeBytes);
  return size ? `${fileTypeLabel(fileType)} · ${size}` : fileTypeLabel(fileType);
}
