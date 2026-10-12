export const UNIT_STATUSES = ["verfuegbar", "anfahrt", "einsatz", "gebunden", "pause", "abgezogen"] as const
export type UnitStatus = (typeof UNIT_STATUSES)[number]

/** An officer in a unit. */
export interface Member {
  id: string
  /** e.g. "SD - Sgt. - Killian Floyd" */
  name: string
  state: MemberState
}

export const MEMBER_STATES = ["verfuegbar", "leitstelle", "beifahrer", "zivil", "sondereinsatz"] as const
/** What an officer in a unit is doing right now. */
export type MemberState = (typeof MEMBER_STATES)[number]

/** A patrol unit (Streife) taking part in an operation. */
export interface Unit {
  id: string
  /** Radio call sign, e.g. "SANDY - 10". */
  callsign: string
  /** Short description of what the unit does, e.g. "Absperrung Nord". */
  description: string
  members: Member[]
  status: UnitStatus
  /** When the unit got its current status. */
  statusSince: string
}

export const TASK_PRIORITIES = ["normal", "hoch", "dringend"] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

/** A job that has to be done during the operation, assigned to any number of units. */
export interface Task {
  id: string
  title: string
  unitIds: string[]
  done: boolean
  /** Missing on tasks of earlier versions, which count as "normal". */
  priority?: TaskPriority
  /** Free details, e.g. who asked for it or what to watch out for. */
  note?: string
  createdAt: string
}

/** The order of priorities from the guide: higher ones come first. */
export const PRIORITIES = ["eigenschutz", "leben", "gefahrenabwehr", "strafverfolgung", "sachwerte"] as const
export type Priority = (typeof PRIORITIES)[number]

/** The questions of "Lage klären" that are answered with yes or no. */
export const LAGE_FACTORS = ["verletzte", "geiseln", "bewaffnete", "fluchtfahrzeuge", "gefahrenbereich"] as const
export type LageFactor = (typeof LAGE_FACTORS)[number]
export type FactorState = "unklar" | "nein" | "ja"

export interface Factor {
  state: FactorState
  /** e.g. "2 Zivilisten, EMS unterwegs". */
  note: string
}

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
export type LogType =
  | "created"
  | "ended"
  | "reopened"
  | "title"
  | "location"
  | "lage"
  | "fallback"
  | "factor"
  | "lead"
  | "unit-added"
  | "unit-removed"
  | "unit-renamed"
  | "unit-status"
  | "unit-description"
  | "member-added"
  | "member-removed"
  | "member-renamed"
  | "member-state"
  | "member-moved"
  | "task-added"
  | "task-assigned"
  | "task-done"
  | "task-reopened"
  | "task-renamed"
  | "task-priority"
  | "task-removed"

export interface LogEntry {
  id: string
  at: string
  /** "system" entries are written automatically on changes, "notiz" entries by hand in the chat. */
  kind: "system" | "notiz"
  /**
   * The note, or what changed. On change entries with a `unit` the call sign isn't part of
   * the text; entries of earlier versions (without `type`) still start with it.
   */
  text: string
  /** Set on change entries written since the history is structured; older ones only have `text`. */
  type?: LogType
  /** Call sign of the unit at the time of the change, shown as a tag in front of the text. */
  unit?: string
  /** The officer a change is about. */
  memberId?: string
  /** Old and new value, e.g. the statuses of a status change. */
  from?: string
  to?: string
  /** The unit a change entry is about, if any. */
  unitId?: string
  /** The units a note is about; a note can concern several. */
  unitIds?: string[]
  /** Set when a note was changed after writing it. */
  editedAt?: string
}

export interface Operation {
  id: string
  title: string
  location: string
  /** What happened. */
  situation: string
  /** Who is involved: suspects, victims, witnesses. */
  involved: string
  /** What the operation is meant to achieve. */
  goal: string
  factors: Record<LageFactor, Factor>
  /**
   * Member ids; roles without an entry, or whose officer was removed, are not assigned.
   * Earlier versions stored names, which are turned into ids when read.
   */
  leads: Partial<Record<LeadRole, string>>
  /** What to do if things go wrong. */
  fallback: Record<Fallback, string>
  units: Unit[]
  tasks: Task[]
  /** Oldest first. */
  log: LogEntry[]
  createdAt: string
  updatedAt: string
  /** Set once the operation is finished. */
  endedAt?: string
  /** Notes of the debrief, by point of `DEBRIEF_POINTS`. */
  debrief: Record<string, string>
  /** The Sammelakte created from the operation, by case file id. */
  caseFileId?: string
  /** Version of the stored shape; older operations are brought up to date once and saved again. */
  schema?: number
}
