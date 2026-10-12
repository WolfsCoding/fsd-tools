/** Route prefix of the case files; must match its `path` in the registry. */
export const POLICE_FILES_BASE = "/case-files"

export function caseFilePath(id: string) {
  return `${POLICE_FILES_BASE}/${id}`
}
