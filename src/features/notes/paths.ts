/** Route prefix of the notes; must match its `path` in the registry. */
export const NOTES_BASE = "/notes"

/** The notes in this folder; the top level when missing. */
export function folderPath(folderId?: string) {
  return folderId ? `${NOTES_BASE}/${folderId}` : NOTES_BASE
}

/** The notes with this one folded open, in the folder it sits in. */
export function notePath(id: string, folderId?: string) {
  return `${folderPath(folderId)}?note=${id}`
}
