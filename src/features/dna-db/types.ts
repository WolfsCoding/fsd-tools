export const TAG_COLORS = [
  "slate",
  "red",
  "amber",
  "emerald",
  "sky",
  "violet",
  "pink",
] as const

export type TagColor = (typeof TAG_COLORS)[number]

/** Tags live on the entries; a name has one color across all entries. */
export interface DnaTag {
  name: string
  color: TagColor
}

export interface DnaEntry {
  id: string
  name: string
  dnaId: string
  fingerprintId: string
  /** Missing on entries saved before tags existed. */
  tags?: DnaTag[]
  /** Numbers of the case files the entry belongs to, as typed; missing on older entries. */
  caseNumbers?: string[]
  createdAt: string
  updatedAt: string
}

export type DnaEntryInput = Pick<DnaEntry, "name" | "dnaId" | "fingerprintId" | "tags" | "caseNumbers">
