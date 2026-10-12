/** Route prefix of the DNA-DB; must match its `path` in the registry. */
export const DNA_DB_BASE = "/dna-db"

/** The page of one entry, with what the Akten record about them. */
export function personPath(entryId: string) {
  return `${DNA_DB_BASE}/person/${entryId}`
}
