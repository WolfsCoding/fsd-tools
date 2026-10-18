import type { Note } from "@/features/notes/types"

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

/** Personal details shown in the person view; all optional, as typed. */
export const PROFILE_FIELDS = [
  { key: "alias", label: "Alias" },
  { key: "gender", label: "Geschlecht" },
  { key: "birthDate", label: "Geburtsdatum" },
  { key: "phone", label: "Telefonnummer" },
  { key: "email", label: "E-Mail" },
  { key: "whistle", label: "Whistle" },
  { key: "address", label: "Adresse" },
] as const

export type ProfileKey = (typeof PROFILE_FIELDS)[number]["key"]


export interface DnaEntry extends Partial<Record<ProfileKey, string>> {
  id: string
  name: string
  dnaId: string
  fingerprintId: string
  /** Missing on entries saved before tags existed. */
  tags?: DnaTag[]
  /** Numbers of the case files the entry belongs to, as typed; missing on older entries. */
  caseNumbers?: string[]
  notes?: Note[]
  createdAt: string
  updatedAt: string
}

export type DnaEntryInput = Pick<
  DnaEntry,
  "name" | "dnaId" | "fingerprintId" | "tags" | "caseNumbers" | "notes" | ProfileKey
>
