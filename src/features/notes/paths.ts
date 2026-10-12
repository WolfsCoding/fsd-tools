/** Route prefix of the notes; must match its `path` in the registry. */
export const NOTES_BASE = "/notes"

export function notePath(id: string) {
  return `${NOTES_BASE}/${id}`
}
