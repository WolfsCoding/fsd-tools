/** Route prefix of the notes; must match its `path` in the registry. */
export const NOTES_BASE = "/notes"

/** The notes with this one folded open. */
export function notePath(id: string) {
  return `${NOTES_BASE}?note=${id}`
}
