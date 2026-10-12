import {
  ArrowRightLeftIcon,
  ChevronsUpIcon,
  CircleCheckIcon,
  CircleDotIcon,
  CircleHelpIcon,
  CircleStopIcon,
  FileTextIcon,
  FlagIcon,
  LifeBuoyIcon,
  ListPlusIcon,
  ListTodoIcon,
  MapPinIcon,
  PencilIcon,
  RotateCcwIcon,
  ShieldIcon,
  ShieldMinusIcon,
  ShieldPlusIcon,
  TextIcon,
  Trash2Icon,
  UserMinusIcon,
  UserPlusIcon,
  type LucideIcon,
} from "lucide-react"
import { LEAD_SHORT } from "./guide"
import { MEMBER_STATE_ICON, MEMBER_STATE_LABEL } from "./member-state"
import { STATUS_LABEL } from "./status"
import { MEMBER_STATES, UNIT_STATUSES, type LogEntry, type LogType, type MemberState, type Unit, type UnitStatus } from "./types"
import { unitName } from "./use-operations"

/** Kinds of change entries the history can be filtered by. */
export const LOG_GROUPS = ["einsatz", "lage", "fuehrung", "streifen", "personal", "aufgaben"] as const
export type LogGroup = (typeof LOG_GROUPS)[number]

export const LOG_GROUP_LABEL: Record<LogGroup, string> = {
  einsatz: "Einsatz",
  lage: "Lage",
  fuehrung: "Führung",
  streifen: "Streifen",
  personal: "Personal",
  aufgaben: "Aufgaben",
}

const TYPES: Record<LogType, { group: LogGroup; icon: LucideIcon }> = {
  created: { group: "einsatz", icon: FlagIcon },
  ended: { group: "einsatz", icon: CircleStopIcon },
  reopened: { group: "einsatz", icon: RotateCcwIcon },
  title: { group: "einsatz", icon: PencilIcon },
  location: { group: "einsatz", icon: MapPinIcon },
  lage: { group: "lage", icon: FileTextIcon },
  fallback: { group: "lage", icon: LifeBuoyIcon },
  factor: { group: "lage", icon: CircleHelpIcon },
  lead: { group: "fuehrung", icon: ShieldIcon },
  "unit-added": { group: "streifen", icon: ShieldPlusIcon },
  "unit-removed": { group: "streifen", icon: ShieldMinusIcon },
  "unit-renamed": { group: "streifen", icon: PencilIcon },
  "unit-status": { group: "streifen", icon: ArrowRightLeftIcon },
  "unit-description": { group: "streifen", icon: TextIcon },
  "member-added": { group: "personal", icon: UserPlusIcon },
  "member-removed": { group: "personal", icon: UserMinusIcon },
  "member-renamed": { group: "personal", icon: PencilIcon },
  "member-state": { group: "personal", icon: CircleDotIcon },
  "member-moved": { group: "personal", icon: ArrowRightLeftIcon },
  "task-added": { group: "aufgaben", icon: ListPlusIcon },
  "task-assigned": { group: "aufgaben", icon: ArrowRightLeftIcon },
  "task-done": { group: "aufgaben", icon: CircleCheckIcon },
  "task-reopened": { group: "aufgaben", icon: RotateCcwIcon },
  "task-renamed": { group: "aufgaben", icon: PencilIcon },
  "task-priority": { group: "aufgaben", icon: ChevronsUpIcon },
  "task-removed": { group: "aufgaben", icon: Trash2Icon },
}

/** How a change entry is shown: its icon and kind, the unit tag and the rest of the text. */
export interface EntryView {
  icon: LucideIcon
  group: LogGroup
  /** Call sign shown as a tag in front. */
  unit?: string
  text: string
  /** Shown as two coloured status chips instead of `text`. */
  status?: { from: UnitStatus; to: UnitStatus }
}

const isStatus = (s: string | undefined): s is UnitStatus => (UNIT_STATUSES as readonly (string | undefined)[]).includes(s)
const isMemberState = (s: string | undefined): s is MemberState =>
  (MEMBER_STATES as readonly (string | undefined)[]).includes(s)

/** How to show a change entry, from its type; entries without one are read from their text. */
export function viewEntry(entry: LogEntry, units: Unit[]): EntryView {
  if (!entry.type) return readLegacy(entry.text, units)
  const { group, icon } = TYPES[entry.type]
  const view = { group, icon, unit: entry.unit, text: entry.text }
  if (entry.type === "unit-status" && isStatus(entry.from) && isStatus(entry.to))
    return { ...view, status: { from: entry.from, to: entry.to } }
  if (entry.type === "member-state" && isMemberState(entry.to)) return { ...view, icon: MEMBER_STATE_ICON[entry.to] }
  return view
}

/** The kind of a change entry, e.g. to filter the history. */
export function entryGroup(entry: LogEntry, units: Unit[]) {
  return viewEntry(entry, units).group
}

const STATUS_BY_LABEL = new Map<string, UnitStatus>([
  ...UNIT_STATUSES.map((s) => [STATUS_LABEL[s], s] as const),
  // Labels of earlier versions, still in older histories.
  ["Vor Ort", "einsatz"],
  ["Gebunden", "gebunden"],
])
const MEMBER_STATE_BY_LABEL = new Map(MEMBER_STATES.map((s) => [MEMBER_STATE_LABEL[s], s]))
const LEAD_PREFIXES = Object.values(LEAD_SHORT).map((s) => `${s}: `)

/**
 * Entries written before the history was structured only have their text. Their wording is
 * known, so this guesses icon, kind and the unit they start with; anything unexpected stays plain text.
 */
function readLegacy(text: string, units: Unit[]): EntryView {
  // Lines about a unit start with its call sign; show it as a tag. Longest name first,
  // so "SANDY - 10" wins over "SANDY - 1".
  const unit = units
    .map((u) => unitName(u))
    .sort((a, b) => b.length - a.length)
    .find((name) => text.startsWith(`${name}: `) || text.startsWith(`${name} `))
  const rest = unit ? text.slice(unit.length).replace(/^:?\s/, "") : text
  const plain = (group: LogGroup, icon: LucideIcon): EntryView => ({ group, icon, text })

  if (text === "Einsatz angelegt") return plain("einsatz", FlagIcon)
  if (text === "Einsatz beendet") return plain("einsatz", CircleStopIcon)
  if (text === "Einsatz wieder aufgenommen") return plain("einsatz", RotateCcwIcon)
  if (text.startsWith("Einsatz umbenannt")) return plain("einsatz", PencilIcon)
  if (text.startsWith("Einsatzort")) return plain("einsatz", MapPinIcon)
  if (text.startsWith("Lage: ")) return plain("lage", CircleHelpIcon)
  if (!unit && LEAD_PREFIXES.some((p) => text.startsWith(p))) return plain("fuehrung", ShieldIcon)

  if (text.startsWith("Aufgabe ")) {
    if (text.endsWith(" erledigt")) return plain("aufgaben", CircleCheckIcon)
    if (text.endsWith(" wieder offen")) return plain("aufgaben", RotateCcwIcon)
    if (text.endsWith(" gelöscht")) return plain("aufgaben", Trash2Icon)
    if (text.includes(" angelegt")) return plain("aufgaben", ListPlusIcon)
    if (text.includes(" umbenannt in ")) return plain("aufgaben", PencilIcon)
    if (text.includes(" → ") || text.endsWith(" abgezogen")) return plain("aufgaben", ArrowRightLeftIcon)
    return plain("aufgaben", ListTodoIcon)
  }

  if (unit) {
    const tagged = (group: LogGroup, icon: LucideIcon, body = rest): EntryView => ({ group, icon, unit, text: body })
    if (rest.startsWith("zum Einsatz hinzugefügt")) return tagged("streifen", ShieldPlusIcon)
    if (rest === "aus dem Einsatz entfernt") return tagged("streifen", ShieldMinusIcon)
    if (rest.startsWith("heißt jetzt ")) return tagged("streifen", PencilIcon)
    if (rest.startsWith("+ ")) return tagged("personal", UserPlusIcon, rest.slice(2))
    if (rest.startsWith("− ")) return tagged("personal", UserMinusIcon, rest.slice(2))
    if (rest.startsWith("„") || rest === "Beschreibung entfernt") return tagged("streifen", TextIcon)

    const [from, to] = rest.split(" → ")
    const fromStatus = STATUS_BY_LABEL.get(from)
    const toStatus = STATUS_BY_LABEL.get(to)
    if (fromStatus && toStatus)
      return { ...tagged("streifen", ArrowRightLeftIcon), status: { from: fromStatus, to: toStatus } }

    const state = to ? MEMBER_STATE_BY_LABEL.get(to) : undefined
    if (state) return tagged("personal", MEMBER_STATE_ICON[state])
    if (rest.includes(" heißt jetzt ")) return tagged("personal", PencilIcon)
    return tagged("streifen", rest.includes(" → ") ? ArrowRightLeftIcon : CircleDotIcon)
  }

  // A person moved between units: "Name: A → B".
  if (text.includes(" → ")) return plain("personal", ArrowRightLeftIcon)
  return plain("einsatz", CircleDotIcon)
}
