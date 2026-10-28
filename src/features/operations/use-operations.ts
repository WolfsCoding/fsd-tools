import { useAtom } from "@effect/atom-react"
import * as Schema from "effect/Schema"
import { useCallback, useEffect, useMemo } from "react"
import type { Identity } from "@/features/case-files/use-case-files"
import { stored } from "@/lib/storage"
import { textKey } from "@/lib/text"
import { FACTOR_LABEL, FALLBACK_LABEL, LEAD_SHORT } from "./guide"
import { MEMBER_STATE_LABEL } from "./member-state"
import { TASK_PRIORITY_LABEL } from "./priority"
import { STATUS_LABEL } from "./status"
import {
  FALLBACKS,
  LAGE_FACTORS,
  LEAD_ROLES,
  MEMBER_STATES,
  UNIT_STATUSES,
  type Factor,
  type FactorState,
  type Fallback,
  type LageFactor,
  type LeadRole,
  StoredOperation,
  type Operation,
  type LogEntry,
  type Member,
  type MemberState,
  type Task,
  type TaskPriority,
  type Unit,
  type UnitStatus,
} from "./types"

export const OPERATIONS_KEY = "einsatz:einsaetze"
const NO_OPERATIONS: StoredOperation[] = []

export const operationsAtom = stored(OPERATIONS_KEY, Schema.Array(StoredOperation), NO_OPERATIONS)

/** Current version of the stored shape, see `Operation.schema`. */
const SCHEMA = 2

export function operationTitle(operation: Operation | undefined) {
  return operation?.title.trim() || "Unbenannter Einsatz"
}

/** Units an entry is about: all units of a note, or the one unit of a change. */
export function logUnitIds(entry: LogEntry) {
  return entry.unitIds ?? (entry.unitId ? [entry.unitId] : [])
}

/** A history entry as one line, with the call sign in front if it's about a unit. */
export function entryText(entry: LogEntry) {
  return entry.unit ? `${entry.unit}: ${entry.text}` : entry.text
}

export function unitName(unit: Unit | undefined) {
  return unit?.callsign.trim() || "Streife ohne Rufname"
}

/** `ids` with `id` added or removed. */
export function toggleId(ids: string[], id: string, on: boolean) {
  return on ? [...ids, id] : ids.filter((x) => x !== id)
}

/** The picked units' call signs, e.g. "SANDY - 10, VP-100"; units no longer in the operation are skipped. */
export function unitNames(units: Unit[], ids: string[]) {
  return units
    .filter((u) => ids.includes(u.id))
    .map((u) => unitName(u))
    .join(", ")
}

/** Open tasks first, then the more urgent, then the older ones. */
export function sortTasks(tasks: Task[]) {
  const rank = (t: Task) => (t.priority === "dringend" ? 2 : t.priority === "hoch" ? 1 : 0)
  return tasks.toSorted(
    (a, b) => Number(a.done) - Number(b.done) || rank(b) - rank(a) || a.createdAt.localeCompare(b.createdAt),
  )
}

export interface UnitInput {
  callsign: string
  description: string
  status: UnitStatus
  /** One name per entry; existing members keep their state when the name stays. */
  memberNames: string[]
}
export type OperationField = "title" | "location" | "situation" | "involved" | "goal"

/** An officer and the unit they're in, by member id. */
export function findMember(operation: Operation, memberId: string | undefined) {
  for (const unit of operation.units) {
    const member = unit.members.find((m) => m.id === memberId)
    if (member) return { unit, member }
  }
  return undefined
}

/** The officer holding `role`; undefined while it's not assigned or the officer was removed. */
export function leadMember(operation: Operation, role: LeadRole) {
  return findMember(operation, operation.leads[role])
}

/**
 * Whether an officer is the user, who always leads the operation. Units name people like
 * "SD - Sgt. - Ryan Shaw", so a name ending in the user's own name counts as well.
 */
export function isOwnName(name: string, me: Identity) {
  const n = name.trim()
  return !!me.name && (n === me.full || n === me.name || n.endsWith(` ${me.name}`))
}

/** Who leads the operation: the picked EL, else the user. */
export function leaderName(operation: Operation, me: Identity) {
  return leadMember(operation, "el")?.member.name ?? me.full
}

/** Whether an officer of a unit is the EL; without a picked EL that's the user. */
export function isLeader(operation: Operation, member: Member, me: Identity) {
  const el = leadMember(operation, "el")
  return el ? member.id === el.member.id : isOwnName(member.name, me)
}

/** The lead roles an officer holds, EL first. */
export function memberRoles(operation: Operation, member: Member, me: Identity): LeadRole[] {
  const roles = LEAD_ROLES.filter((r) => r !== "el" && operation.leads[r] === member.id)
  return isLeader(operation, member, me) ? ["el", ...roles] : roles
}

/** The unit the user is in, if any. */
export function ownUnit(operation: Operation, me: Identity) {
  return operation.units.find((u) => u.members.some((m) => isOwnName(m.name, me)))
}

/** Units sharing a call sign with another unit of the operation. */
export function duplicateCallsigns(units: Unit[]) {
  const count = new Map<string, number>()
  for (const u of units) if (textKey(u.callsign)) count.set(textKey(u.callsign), (count.get(textKey(u.callsign)) ?? 0) + 1)
  return new Set(units.filter((u) => (count.get(textKey(u.callsign)) ?? 0) > 1).map((u) => u.id))
}

const emptyRecord = <K extends string, V>(keys: readonly K[], value: () => V) =>
  Object.fromEntries(keys.map((k) => [k, value()])) as Record<K, V>
const newFactors = () => emptyRecord(LAGE_FACTORS, (): Factor => ({ state: "unklar", note: "" }))

const uid = () => crypto.randomUUID()
const now = () => new Date().toISOString()
const quote = (s: string) => `„${s}“`
/** Long texts like the Lage are cut in history lines; the full text stays in `to`. */
const short = (s: string) => quote(s.length > 120 ? `${s.slice(0, 120).trimEnd()}…` : s)

/** `list` with `item` put back at `index`, unless it's still there. */
function insertAt<T extends { id: string }>(list: T[], index: number, item: T) {
  if (list.some((x) => x.id === item.id)) return list
  return list.toSpliced(Math.min(index, list.length), 0, item)
}

/** A history entry before it gets its id and time. */
type Line = Omit<LogEntry, "id" | "at" | "kind">
type LogLines = Line[] | ((before: Operation, after: Operation) => Line[])

function entry(line: Line, kind: LogEntry["kind"] = "system"): LogEntry {
  return { id: uid(), at: now(), kind, ...line, unitIds: line.unitIds?.length ? line.unitIds : undefined }
}

/** Whether a stored operation already has the current shape; imports may claim the version without it. */
const isCurrent = (raw: StoredOperation): raw is Operation => {
  const e = raw as Partial<Operation>
  return e.schema === SCHEMA && typeof e.debrief === "object" && e.debrief !== null
}

// Migrated operations by their stored object, so every reader gets the same ids until they're saved.
const migrated = new WeakMap<StoredOperation, Operation>()

/** The operation in the current shape; stored ones are migrated once and then saved by `useOperations`. */
function normalize(raw: StoredOperation): Operation {
  if (isCurrent(raw)) return raw
  let operation = migrated.get(raw)
  if (!operation) {
    operation = migrate(raw)
    migrated.set(raw, operation)
  }
  return operation
}

/** Brings operations stored by earlier versions into the current shape. */
function migrate(raw: StoredOperation): Operation {
  const e = raw as Partial<Operation> & Pick<Operation, "id" | "title" | "units" | "tasks" | "log" | "createdAt" | "updatedAt"> & { notes?: string }
  const log = e.log.map((l) => ((l.kind as string) === "meldung" ? { ...l, kind: "notiz" as const } : l))
  if (e.notes?.trim()) log.push({ id: uid(), at: e.updatedAt, kind: "notiz", text: e.notes.trim() })
  const units = e.units.map(normalizeUnit)
  return {
    id: e.id,
    title: e.title,
    location: e.location ?? "",
    situation: e.situation ?? "",
    involved: e.involved ?? "",
    goal: e.goal ?? "",
    factors: { ...newFactors(), ...e.factors },
    leads: leadIds(e.leads ?? {}, units),
    fallback: { ...emptyRecord(FALLBACKS, () => ""), ...e.fallback },
    units,
    tasks: e.tasks.map(normalizeTask),
    log,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    endedAt: e.endedAt,
    debrief: e.debrief ?? {},
    caseFileId: e.caseFileId,
    schema: SCHEMA,
  }
}

/** Leads used to be stored by name; names of officers no longer in a unit are dropped. */
function leadIds(leads: Operation["leads"], units: Unit[]) {
  const members = units.flatMap((u) => u.members)
  const ids: Operation["leads"] = {}
  for (const role of LEAD_ROLES) {
    const value = leads[role]?.trim()
    const member = value && (members.find((m) => m.id === value) ?? members.find((m) => m.name.trim() === value))
    if (member) ids[role] = member.id
  }
  return ids
}

/** Tasks used to belong to at most one unit. */
function normalizeTask(raw: Task): Task {
  const t = raw as Task & { unitId?: string }
  if (Array.isArray(t.unitIds)) return t
  const { unitId, ...rest } = t
  return { ...rest, unitIds: unitId ? [unitId] : [] }
}

function normalizeUnit(raw: Unit): Unit {
  const u = raw as Omit<Unit, "members" | "status"> & { members: Member[] | string; status: string; location?: string }
  const members: Member[] =
    typeof u.members === "string"
      ? u.members
          .split(/[,\n]/)
          .map((name) => name.trim())
          .filter(Boolean)
          .map((name) => ({ id: uid(), name, state: "verfuegbar" }))
      : u.members.map(normalizeMember)
  const status = u.status === "vor-ort" ? "einsatz" : (UNIT_STATUSES as readonly string[]).includes(u.status) ? u.status : "verfuegbar"
  return {
    id: u.id,
    callsign: u.callsign,
    description: u.description ?? u.location ?? "",
    members,
    status: status as UnitStatus,
    statusSince: u.statusSince ?? now(),
  }
}

/** Earlier versions only knew "vor Ort" (✓) and "nur erreichbar" (☎). */
function normalizeMember(raw: Member): Member {
  const m = raw as Member & { present?: boolean }
  if ((MEMBER_STATES as readonly string[]).includes(m.state)) return m
  return { id: m.id, name: m.name, state: m.present === false ? "beifahrer" : "verfuegbar" }
}

/** What changed between two versions of a unit, as history lines. */
function unitChanges(before: Unit, after: Unit): Line[] {
  const unit = unitName(after)
  const about = { unit, unitId: after.id }
  const lines: Line[] = []
  if (after.callsign.trim() !== before.callsign.trim())
    lines.push({
      ...about,
      type: "unit-renamed",
      unit: unitName(before),
      text: `heißt jetzt ${unit}`,
      from: unitName(before),
      to: unit,
    })
  if (after.status !== before.status)
    lines.push({
      ...about,
      type: "unit-status",
      text: `${STATUS_LABEL[before.status]} → ${STATUS_LABEL[after.status]}`,
      from: before.status,
      to: after.status,
    })
  const description = after.description.trim()
  if (description !== before.description.trim())
    lines.push({
      ...about,
      type: "unit-description",
      text: description ? quote(description) : "Beschreibung entfernt",
      to: description,
    })
  const ids = (u: Unit) => new Set(u.members.map((m) => m.id))
  for (const m of after.members.filter((m) => !ids(before).has(m.id)))
    lines.push({ ...about, type: "member-added", memberId: m.id, text: `${m.name} hinzugefügt` })
  for (const m of before.members.filter((m) => !ids(after).has(m.id)))
    lines.push({ ...about, type: "member-removed", memberId: m.id, text: `${m.name} entfernt` })
  return lines
}

export const FACTOR_STATE_LABEL: Record<FactorState, string> = { unklar: "unklar", nein: "nein", ja: "ja" }

/** How each field is named in the history. */
const FIELD_LOG: Record<OperationField, { type: LogEntry["type"]; label: string }> = {
  title: { type: "title", label: "Einsatz umbenannt in" },
  location: { type: "location", label: "Einsatzort" },
  situation: { type: "lage", label: "Lage:" },
  involved: { type: "lage", label: "Beteiligte:" },
  goal: { type: "lage", label: "Ziel:" },
}

export function useOperations() {
  const [stored, setAll] = useAtom(operationsAtom)

  // Running operations first, then the newest. Not sorted by the last change, so an
  // operation doesn't move while it's being edited.
  const operations = useMemo(
    () =>
      stored
        .map(normalize)
        .sort((a, b) => Number(!!a.endedAt) - Number(!!b.endedAt) || b.createdAt.localeCompare(a.createdAt)),
    [stored],
  )

  // Saves operations of earlier versions once in the current shape.
  useEffect(() => {
    if (!stored.every(isCurrent)) setAll((prev) => prev.map(normalize))
  }, [stored, setAll])

  /** Applies `fn` to operation `id` and appends the `log` lines to its history. */
  const change = useCallback(
    (id: string, fn: (e: Operation) => Operation, log: LogLines = []) =>
      setAll((prev) =>
        prev.map((raw) => {
          if (raw.id !== id) return raw
          const e = normalize(raw)
          const next = fn(e)
          const lines = typeof log === "function" ? log(e, next) : log
          return { ...next, log: [...next.log, ...lines.map((l) => entry(l))], updatedAt: now() }
        }),
      ),
    [setAll],
  )

  const createOperation = useCallback(() => {
    const operation: Operation = {
      id: uid(),
      title: "",
      location: "",
      situation: "",
      involved: "",
      goal: "",
      factors: newFactors(),
      leads: {},
      fallback: emptyRecord(FALLBACKS, () => ""),
      units: [],
      tasks: [],
      log: [entry({ type: "created", text: "Einsatz angelegt" })],
      createdAt: now(),
      updatedAt: now(),
      debrief: {},
      schema: SCHEMA,
    }
    setAll((prev) => [...prev, operation])
    return operation.id
  }, [setAll])

  const deleteOperation = useCallback((id: string) => setAll((prev) => prev.filter((e) => e.id !== id)), [setAll])

  /** Puts back an operation removed with `deleteOperation`; the list is sorted, so its place doesn't matter. */
  const restoreOperation = useCallback(
    (operation: Operation) => setAll((prev) => (prev.some((e) => e.id === operation.id) ? prev : [...prev, operation])),
    [setAll],
  )

  const actions = useMemo(() => {
    /** Changes one unit and logs what changed. */
    const changeUnit = (id: string, unitId: string, fn: (u: Unit) => Unit) =>
      change(
        id,
        (e) => ({
          ...e,
          units: e.units.map((u) => {
            if (u.id !== unitId) return u
            const next = fn(u)
            return next.status === u.status ? next : { ...next, statusSince: now() }
          }),
        }),
        (before, after) => {
          const b = before.units.find((u) => u.id === unitId)
          const a = after.units.find((u) => u.id === unitId)
          return a && b ? unitChanges(b, a) : []
        },
      )

    /** Changes one member of a unit, without logging. */
    const mapMember = (e: Operation, unitId: string, memberId: string, fn: (m: Member) => Member) => ({
      ...e,
      units: e.units.map((u) =>
        u.id !== unitId ? u : { ...u, members: u.members.map((m) => (m.id === memberId ? fn(m) : m)) },
      ),
    })

    const mapTask = (e: Operation, taskId: string, fn: (t: Task) => Task) => ({
      ...e,
      tasks: e.tasks.map((t) => (t.id === taskId ? fn(t) : t)),
    })

    /** Members for `names`, keeping id and state of names that were already there. */
    const membersFor = (names: string[], existing: Member[] = []) =>
      names.map((name): Member => existing.find((m) => m.name === name) ?? { id: uid(), name, state: "verfuegbar" })

    return {
      /** Saves a field while it's typed, without logging. */
      setField(id: string, field: OperationField, value: string) {
        change(id, (e) => ({ ...e, [field]: value }))
      },
      /** Logs a finished edit of a field, e.g. when its input loses focus. */
      commitField(id: string, field: OperationField, before: string, after: string) {
        const { type, label } = FIELD_LOG[field]
        const text = after.trim()
        if (before.trim() === text) return
        change(id, (e) => e, [{ type, text: text ? `${label} ${short(text)}` : `${label} entfernt`, to: text }])
      },
      finish(id: string) {
        change(id, (e) => ({ ...e, endedAt: now() }), [{ type: "ended", text: "Einsatz beendet" }])
      },
      reopen(id: string) {
        change(id, (e) => ({ ...e, endedAt: undefined }), [{ type: "reopened", text: "Einsatz wieder aufgenommen" }])
      },
      /** Remembers the Sammelakte created from the operation, without logging. */
      setCaseFile(id: string, caseFileId: string) {
        change(id, (e) => ({ ...e, caseFileId }))
      },
      /** Saves the notes on one debrief point while they're typed. */
      setDebrief(id: string, point: string, text: string) {
        change(id, (e) => ({ ...e, debrief: { ...e.debrief, [point]: text } }))
      },

      /** Logs a yes/no answer of "Lage klären". */
      setFactor(id: string, factor: LageFactor, state: FactorState) {
        change(
          id,
          (e) => ({ ...e, factors: { ...e.factors, [factor]: { ...e.factors[factor], state } } }),
          (before) => {
            const was = before.factors[factor].state
            if (was === state) return []
            return [{ type: "factor", text: `Lage: ${FACTOR_LABEL[factor]} → ${FACTOR_STATE_LABEL[state]}`, from: was, to: state }]
          },
        )
      },
      /** Saves the details of a factor while they're typed, without logging. */
      setFactorNote(id: string, factor: LageFactor, note: string) {
        change(id, (e) => ({ ...e, factors: { ...e.factors, [factor]: { ...e.factors[factor], note } } }))
      },
      /** Assigns a lead role to an officer, or clears it without `memberId`. */
      setLead(id: string, role: LeadRole, memberId: string | undefined) {
        change(
          id,
          (e) => ({ ...e, leads: { ...e.leads, [role]: memberId || undefined } }),
          (before) => {
            const was = leadMember(before, role)?.member.id
            if (was === (memberId || undefined)) return []
            const picked = findMember(before, memberId)
            if (picked) return [{ type: "lead", memberId, text: `${LEAD_SHORT[role]}: ${picked.member.name}` }]
            return [{ type: "lead", text: role === "el" ? "EL: eigene Person" : `${LEAD_SHORT[role]}: nicht mehr besetzt` }]
          },
        )
      },
      setFallback(id: string, key: Fallback, text: string) {
        change(id, (e) => ({ ...e, fallback: { ...e.fallback, [key]: text } }))
      },
      /** Logs a finished edit of the fallback plan. */
      commitFallback(id: string, key: Fallback, before: string, after: string) {
        const text = after.trim()
        if (before.trim() === text) return
        const label = `Rückfallebene ${FALLBACK_LABEL[key].toLowerCase()}:`
        change(id, (e) => e, [{ type: "fallback", text: text ? `${label} ${short(text)}` : `${label} entfernt`, to: text }])
      },
      addNote(id: string, text: string, unitIds: string[] = []) {
        const note = entry({ text, unitIds }, "notiz")
        change(id, (e) => ({ ...e, log: [...e.log, note] }))
      },
      editNote(id: string, entryId: string, text: string) {
        change(id, (e) => ({
          ...e,
          log: e.log.map((l) => (l.id === entryId && l.kind === "notiz" ? { ...l, text, editedAt: now() } : l)),
        }))
      },
      deleteNote(id: string, entryId: string) {
        change(id, (e) => ({ ...e, log: e.log.filter((l) => l.id !== entryId || l.kind !== "notiz") }))
      },
      /** Puts a deleted note back in its place in time. */
      restoreNote(id: string, note: LogEntry) {
        change(id, (e) => {
          const index = e.log.findIndex((l) => l.at > note.at)
          return { ...e, log: insertAt(e.log, index < 0 ? e.log.length : index, note) }
        })
      },

      addUnit(id: string, input: UnitInput) {
        const unit: Unit = {
          id: uid(),
          callsign: input.callsign,
          description: input.description,
          status: input.status,
          members: membersFor(input.memberNames),
          statusSince: now(),
        }
        const details = [STATUS_LABEL[unit.status], `${unit.members.length} Personen`]
        change(id, (e) => ({ ...e, units: [...e.units, unit] }), [
          { type: "unit-added", unit: unitName(unit), unitId: unit.id, text: `zum Einsatz hinzugefügt (${details.join(", ")})` },
        ])
      },
      updateUnit(id: string, unitId: string, input: Partial<UnitInput>) {
        changeUnit(id, unitId, (u) => ({
          ...u,
          ...(input.callsign !== undefined && { callsign: input.callsign }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.status !== undefined && { status: input.status }),
          ...(input.memberNames !== undefined && { members: membersFor(input.memberNames, u.members) }),
        }))
      },
      removeUnit(id: string, unit: Unit) {
        change(
          id,
          (e) => ({
            ...e,
            units: e.units.filter((u) => u.id !== unit.id),
            tasks: e.tasks.map((t) => ({ ...t, unitIds: t.unitIds.filter((u) => u !== unit.id) })),
          }),
          [{ type: "unit-removed", unit: unitName(unit), unitId: unit.id, text: "aus dem Einsatz entfernt" }],
        )
      },
      /** Undoes `removeUnit`: the unit goes back to `index` and onto the tasks in `taskIds`. */
      restoreUnit(id: string, unit: Unit, index: number, taskIds: string[]) {
        change(
          id,
          (e) => ({
            ...e,
            units: insertAt(e.units, index, unit),
            tasks: e.tasks.map((t) =>
              taskIds.includes(t.id) && !t.unitIds.includes(unit.id) ? { ...t, unitIds: [...t.unitIds, unit.id] } : t,
            ),
          }),
          [{ type: "unit-added", unit: unitName(unit), unitId: unit.id, text: "wieder hinzugefügt" }],
        )
      },

      setMemberState(id: string, unit: Unit, member: Member, state: MemberState) {
        if (state === member.state) return
        change(id, (e) => mapMember(e, unit.id, member.id, (m) => ({ ...m, state })), [
          {
            type: "member-state",
            unit: unitName(unit),
            unitId: unit.id,
            memberId: member.id,
            text: `${member.name} → ${MEMBER_STATE_LABEL[state]}`,
            from: member.state,
            to: state,
          },
        ])
      },
      addMember(id: string, unit: Unit, name: string) {
        changeUnit(id, unit.id, (u) =>
          u.members.some((m) => m.name === name)
            ? u
            : { ...u, members: [...u.members, { id: uid(), name, state: "verfuegbar" }] },
        )
      },
      renameMember(id: string, unit: Unit, member: Member, name: string) {
        if (name === member.name) return
        change(id, (e) => mapMember(e, unit.id, member.id, (m) => ({ ...m, name })), [
          {
            type: "member-renamed",
            unit: unitName(unit),
            unitId: unit.id,
            memberId: member.id,
            text: `${member.name} heißt jetzt ${name}`,
            from: member.name,
            to: name,
          },
        ])
      },
      removeMember(id: string, unit: Unit, member: Member) {
        changeUnit(id, unit.id, (u) => ({ ...u, members: u.members.filter((m) => m.id !== member.id) }))
      },
      /** Undoes `removeMember`; the officer keeps the lead roles they had. */
      restoreMember(id: string, unit: Unit, member: Member, index: number) {
        changeUnit(id, unit.id, (u) => ({ ...u, members: insertAt(u.members, index, member) }))
      },
      moveMember(id: string, from: Unit, to: Unit, member: Member) {
        change(
          id,
          (e) => ({
            ...e,
            units: e.units.map((u) =>
              u.id === from.id
                ? { ...u, members: u.members.filter((m) => m.id !== member.id) }
                : u.id === to.id
                  ? { ...u, members: [...u.members, member] }
                  : u,
            ),
          }),
          [
            {
              type: "member-moved",
              unitIds: [from.id, to.id],
              memberId: member.id,
              text: `${member.name}: ${unitName(from)} → ${unitName(to)}`,
              from: unitName(from),
              to: unitName(to),
            },
          ],
        )
      },

      addTask(id: string, title: string, units: Unit[] = [], priority: TaskPriority = "normal") {
        const task: Task = { id: uid(), title, unitIds: units.map((u) => u.id), done: false, priority, createdAt: now() }
        const to = units.length ? ` → ${units.map(unitName).join(", ")}` : ""
        const urgent = priority === "normal" ? "" : ` (${TASK_PRIORITY_LABEL[priority]})`
        change(id, (e) => ({ ...e, tasks: [...e.tasks, task] }), [
          { type: "task-added", text: `Aufgabe ${quote(title)}${urgent} angelegt${to}`, unitIds: task.unitIds },
        ])
      },
      /** Assigns the task to exactly `unitIds` and logs who was added or taken off. */
      setTaskUnits(id: string, task: Task, unitIds: string[]) {
        change(
          id,
          (e) => mapTask(e, task.id, (t) => ({ ...t, unitIds })),
          (before) => {
            const names = (ids: string[]) =>
              ids.map((uid) => unitName(before.units.find((u) => u.id === uid))).join(", ")
            const added = unitIds.filter((u) => !task.unitIds.includes(u))
            const removed = task.unitIds.filter((u) => !unitIds.includes(u))
            const lines: Line[] = []
            if (added.length)
              lines.push({ type: "task-assigned", text: `Aufgabe ${quote(task.title)} → ${names(added)}`, unitIds: added })
            if (removed.length)
              lines.push({
                type: "task-assigned",
                text: `Aufgabe ${quote(task.title)}: ${names(removed)} abgezogen`,
                unitIds: removed,
              })
            return lines
          },
        )
      },
      toggleTask(id: string, task: Task) {
        change(id, (e) => mapTask(e, task.id, (t) => ({ ...t, done: !t.done })), [
          {
            type: task.done ? "task-reopened" : "task-done",
            text: `Aufgabe ${quote(task.title)} ${task.done ? "wieder offen" : "erledigt"}`,
            unitIds: task.unitIds,
          },
        ])
      },
      setTaskPriority(id: string, task: Task, priority: TaskPriority) {
        if (priority === (task.priority ?? "normal")) return
        change(id, (e) => mapTask(e, task.id, (t) => ({ ...t, priority })), [
          {
            type: "task-priority",
            text: `Aufgabe ${quote(task.title)}: Priorität ${TASK_PRIORITY_LABEL[priority]}`,
            from: task.priority ?? "normal",
            to: priority,
            unitIds: task.unitIds,
          },
        ])
      },
      /** Saves the task's details while they're typed, without logging. */
      setTaskNote(id: string, taskId: string, note: string) {
        change(id, (e) => mapTask(e, taskId, (t) => ({ ...t, note })))
      },
      renameTask(id: string, task: Task, title: string) {
        if (!title || title === task.title) return
        change(id, (e) => mapTask(e, task.id, (t) => ({ ...t, title })), [
          {
            type: "task-renamed",
            text: `Aufgabe ${quote(task.title)} umbenannt in ${quote(title)}`,
            from: task.title,
            to: title,
            unitIds: task.unitIds,
          },
        ])
      },
      removeTask(id: string, task: Task) {
        change(id, (e) => ({ ...e, tasks: e.tasks.filter((t) => t.id !== task.id) }), [
          { type: "task-removed", text: `Aufgabe ${quote(task.title)} gelöscht`, unitIds: task.unitIds },
        ])
      },
      /** Undoes `removeTask`; units removed in the meantime are dropped from it. */
      restoreTask(id: string, task: Task, index: number) {
        change(
          id,
          (e) => ({
            ...e,
            tasks: insertAt(e.tasks, index, { ...task, unitIds: task.unitIds.filter((u) => e.units.some((x) => x.id === u)) }),
          }),
          [{ type: "task-added", text: `Aufgabe ${quote(task.title)} wiederhergestellt`, unitIds: task.unitIds }],
        )
      },
    }
  }, [change])

  return { operations, createOperation, deleteOperation, restoreOperation, ...actions }
}
