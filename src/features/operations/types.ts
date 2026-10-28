import * as Schema from "effect/Schema"
import type { StoredValue } from "@/lib/storage"

export const UNIT_STATUSES = ["verfuegbar", "anfahrt", "einsatz", "gebunden", "pause", "abgezogen"] as const
export type UnitStatus = (typeof UNIT_STATUSES)[number]

export const MEMBER_STATES = ["verfuegbar", "leitstelle", "beifahrer", "zivil", "sondereinsatz"] as const
/** What an officer in a unit is doing right now. */
export type MemberState = (typeof MEMBER_STATES)[number]

/** An officer in a unit. */
export const Member = Schema.Struct({
  id: Schema.String,
  /** e.g. "SD - Sgt. - Killian Floyd" */
  name: Schema.String,
  state: Schema.Literals(MEMBER_STATES),
})
export type Member = StoredValue<typeof Member>

/** A patrol unit (Streife) taking part in an operation. */
export const Unit = Schema.Struct({
  id: Schema.String,
  /** Radio call sign, e.g. "SANDY - 10". */
  callsign: Schema.String,
  /** Short description of what the unit does, e.g. "Absperrung Nord". */
  description: Schema.String,
  members: Schema.Array(Member),
  status: Schema.Literals(UNIT_STATUSES),
  /** When the unit got its current status. */
  statusSince: Schema.String,
})
export type Unit = StoredValue<typeof Unit>

export const TASK_PRIORITIES = ["normal", "hoch", "dringend"] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

/** A job that has to be done during the operation, assigned to any number of units. */
export const Task = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  unitIds: Schema.Array(Schema.String),
  done: Schema.Boolean,
  /** Missing on tasks of earlier versions, which count as "normal". */
  priority: Schema.optionalKey(Schema.Literals(TASK_PRIORITIES)),
  /** Free details, e.g. who asked for it or what to watch out for. */
  note: Schema.optionalKey(Schema.String),
  createdAt: Schema.String,
})
export type Task = StoredValue<typeof Task>

/** The order of priorities from the guide: higher ones come first. */
export const PRIORITIES = ["eigenschutz", "leben", "gefahrenabwehr", "strafverfolgung", "sachwerte"] as const
export type Priority = (typeof PRIORITIES)[number]

/** The questions of "Lage klären" that are answered with yes or no. */
export const LAGE_FACTORS = ["verletzte", "geiseln", "bewaffnete", "fluchtfahrzeuge", "gefahrenbereich"] as const
export type LageFactor = (typeof LAGE_FACTORS)[number]
export const FACTOR_STATES = ["unklar", "nein", "ja"] as const
export type FactorState = (typeof FACTOR_STATES)[number]

export const Factor = Schema.Struct({
  state: Schema.Literals(FACTOR_STATES),
  /** e.g. "2 Zivilisten, EMS unterwegs". */
  note: Schema.String,
})
export type Factor = StoredValue<typeof Factor>

/** EL, Co-EL and the Bereichsleitungen of the guide. Without an EL set, the user leads. */
export const LEAD_ROLES = [
  "el",
  "coel",
  "absperrung",
  "verhandlung",
  "zugriff",
  "ems",
  "tv",
  "zeugen",
  "beweise",
  "akten",
  "abhandlung",
  "funk",
] as const
export type LeadRole = (typeof LEAD_ROLES)[number]

/** Situations the fallback plan covers. */
export const FALLBACKS = ["schuesse", "flucht", "verhandlung"] as const
export type Fallback = (typeof FALLBACKS)[number]

/** What a change entry is about. */
export const LOG_TYPES = [
  "created",
  "ended",
  "reopened",
  "title",
  "location",
  "lage",
  "fallback",
  "factor",
  "lead",
  "unit-added",
  "unit-removed",
  "unit-renamed",
  "unit-status",
  "unit-description",
  "member-added",
  "member-removed",
  "member-renamed",
  "member-state",
  "member-moved",
  "task-added",
  "task-assigned",
  "task-done",
  "task-reopened",
  "task-renamed",
  "task-priority",
  "task-removed",
] as const
export type LogType = (typeof LOG_TYPES)[number]

export const LogEntry = Schema.Struct({
  id: Schema.String,
  at: Schema.String,
  /** "system" entries are written automatically on changes, "notiz" entries by hand in the chat. */
  kind: Schema.Literals(["system", "notiz"]),
  /**
   * The note, or what changed. On change entries with a `unit` the call sign isn't part of
   * the text; entries of earlier versions (without `type`) still start with it.
   */
  text: Schema.String,
  /** Set on change entries written since the history is structured; older ones only have `text`. */
  type: Schema.optionalKey(Schema.Literals(LOG_TYPES)),
  /** Call sign of the unit at the time of the change, shown as a tag in front of the text. */
  unit: Schema.optionalKey(Schema.String),
  /** The officer a change is about. */
  memberId: Schema.optionalKey(Schema.String),
  /** Old and new value, e.g. the statuses of a status change. */
  from: Schema.optionalKey(Schema.String),
  to: Schema.optionalKey(Schema.String),
  /** The unit a change entry is about, if any. */
  unitId: Schema.optionalKey(Schema.String),
  /** The units a note is about; a note can concern several. */
  unitIds: Schema.optionalKey(Schema.Array(Schema.String)),
  /** Set when a note was changed after writing it. */
  editedAt: Schema.optionalKey(Schema.String),
})
export type LogEntry = StoredValue<typeof LogEntry>

/** A struct with one optional field of `value` per key, e.g. the leads by role. */
function partialRecord<const K extends readonly string[], V extends Schema.Top>(keys: K, value: V) {
  return Schema.Struct(
    Object.fromEntries(keys.map((k) => [k, Schema.optionalKey(value)])) as { [P in K[number]]: Schema.optionalKey<V> },
  )
}

/** A struct with one required field of `value` per key, e.g. the factors of the Lage. */
function record<const K extends readonly string[], V extends Schema.Top>(keys: K, value: V) {
  return Schema.Struct(Object.fromEntries(keys.map((k) => [k, value])) as { [P in K[number]]: V })
}

export const Operation = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  location: Schema.String,
  /** What happened. */
  situation: Schema.String,
  /** Who is involved: suspects, victims, witnesses. */
  involved: Schema.String,
  /** What the operation is meant to achieve. */
  goal: Schema.String,
  factors: record(LAGE_FACTORS, Factor),
  /**
   * Member ids; roles without an entry, or whose officer was removed, are not assigned.
   * Earlier versions stored names, which are turned into ids when read.
   */
  leads: partialRecord(LEAD_ROLES, Schema.String),
  /** What to do if things go wrong. */
  fallback: record(FALLBACKS, Schema.String),
  units: Schema.Array(Unit),
  tasks: Schema.Array(Task),
  /** Oldest first. */
  log: Schema.Array(LogEntry),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  /** Set once the operation is finished. */
  endedAt: Schema.optionalKey(Schema.String),
  /** Notes of the debrief, by point of `DEBRIEF_POINTS`. */
  debrief: Schema.Record(Schema.String, Schema.String),
  /** The Sammelakte created from the operation, by case file id. */
  caseFileId: Schema.optionalKey(Schema.String),
  /** Version of the stored shape; older operations are brought up to date once and saved again. */
  schema: Schema.optionalKey(Schema.Number),
})
export type Operation = StoredValue<typeof Operation>

/**
 * An operation as stored by any version: the fields every version had. The rest is
 * brought up to date when read (`normalize` in use-operations).
 */
export const StoredOperation = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  units: Schema.Array(Schema.Unknown),
  tasks: Schema.Array(Schema.Unknown),
  log: Schema.Array(Schema.Unknown),
  createdAt: Schema.String,
  updatedAt: Schema.String,
})
export type StoredOperation = StoredValue<typeof StoredOperation>
