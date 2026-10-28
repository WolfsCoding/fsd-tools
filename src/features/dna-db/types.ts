import * as Schema from "effect/Schema"
import { Note } from "@/features/notes/types"
import type { StoredValue } from "@/lib/storage"

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
export const DnaTag = Schema.Struct({
  name: Schema.String,
  color: Schema.Literals(TAG_COLORS),
})
export type DnaTag = StoredValue<typeof DnaTag>

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

export const DnaEntry = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  dnaId: Schema.String,
  fingerprintId: Schema.String,
  /** Missing on entries saved before tags existed. */
  tags: Schema.optionalKey(Schema.Array(DnaTag)),
  /** Numbers of the case files the entry belongs to, as typed; missing on older entries. */
  caseNumbers: Schema.optionalKey(Schema.Array(Schema.String)),
  notes: Schema.optionalKey(Schema.Array(Note)),
  alias: Schema.optionalKey(Schema.String),
  gender: Schema.optionalKey(Schema.String),
  birthDate: Schema.optionalKey(Schema.String),
  phone: Schema.optionalKey(Schema.String),
  email: Schema.optionalKey(Schema.String),
  whistle: Schema.optionalKey(Schema.String),
  address: Schema.optionalKey(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
})
export type DnaEntry = StoredValue<typeof DnaEntry>

export type DnaEntryInput = Pick<
  DnaEntry,
  "name" | "dnaId" | "fingerprintId" | "tags" | "caseNumbers" | "notes" | ProfileKey
>
