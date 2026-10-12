import { formatDate, formatDateTime } from "@/lib/format-date"
import type { Identity } from "@/features/case-files/use-case-files"
import { formatDuration, formatTime } from "./format"
import { DEBRIEF_POINTS, FACTOR_LABEL, FALLBACK_LABEL, LEAD_LABEL, LEAD_SHORT } from "./guide"
import { MEMBER_STATE_LABEL } from "./member-state"
import { TASK_PRIORITY_LABEL } from "./priority"
import { STATUS_LABEL } from "./status"
import { FALLBACKS, LAGE_FACTORS, LEAD_ROLES, type Operation } from "./types"
import {
  entryText,
  FACTOR_STATE_LABEL,
  leaderName,
  leadMember,
  memberRoles,
  operationTitle,
  sortTasks,
  unitName,
  unitNames,
} from "./use-operations"

/** Text on one Markdown line; line breaks typed into a field would end a list item. */
export const line = (s: string) => s.trim().replace(/\s*\n+\s*/g, " / ")

/**
 * The operation as a Markdown report: Lage, Ziel, units with their people, tasks,
 * the history and the debrief, e.g. to paste into a file or a forum post.
 */
export function operationReport(operation: Operation, me: Identity) {
  const out: string[] = [`# ${operationTitle(operation)}`, ""]
  const start = operation.createdAt
  const end = operation.endedAt
  out.push(
    `- **Einsatzort:** ${line(operation.location) || "–"}`,
    `- **Beginn:** ${formatDateTime(start)}`,
    end
      ? `- **Ende:** ${formatDateTime(end)} (${formatDuration(start, end)})`
      : `- **Läuft seit:** ${formatDuration(start, new Date())}`,
    `- **Einsatzleitung:** ${leaderName(operation, me) || "–"}`,
  )
  const coel = leadMember(operation, "coel")
  if (coel) out.push(`- **Co-Einsatzleitung:** ${coel.member.name}`)

  const section = (title: string, lines: string[]) => {
    if (lines.length) out.push("", `## ${title}`, "", ...lines)
  }

  section(
    "Lage",
    [
      operation.situation.trim() && `- **Was ist passiert?** ${line(operation.situation)}`,
      operation.involved.trim() && `- **Wer ist beteiligt?** ${line(operation.involved)}`,
      ...LAGE_FACTORS.filter((f) => operation.factors[f].state !== "unklar").map((f) => {
        const { state, note } = operation.factors[f]
        return `- ${FACTOR_LABEL[f]}: ${FACTOR_STATE_LABEL[state]}${note.trim() ? ` – ${line(note)}` : ""}`
      }),
    ].filter((s): s is string => !!s),
  )
  section("Ziel", operation.goal.trim() ? [line(operation.goal)] : [])
  section(
    "Rückfallebene",
    FALLBACKS.filter((f) => operation.fallback[f].trim()).map((f) => `- ${FALLBACK_LABEL[f]}: ${line(operation.fallback[f])}`),
  )
  section(
    "Bereichsleitungen",
    LEAD_ROLES.filter((r) => r !== "el" && r !== "coel").flatMap((r) => {
      const lead = leadMember(operation, r)
      return lead ? [`- ${LEAD_LABEL[r]}: ${lead.member.name}`] : []
    }),
  )

  section(
    "Streifen",
    operation.units.flatMap((u) => [
      `### ${unitName(u)} – ${STATUS_LABEL[u.status]}${u.description.trim() ? ` (${line(u.description)})` : ""}`,
      "",
      ...(u.members.length
        ? u.members.map((m) => {
            const roles = memberRoles(operation, m, me).map((r) => LEAD_SHORT[r])
            const state = m.state === "verfuegbar" ? "" : ` (${MEMBER_STATE_LABEL[m.state]})`
            return `- ${m.name}${state}${roles.length ? ` – ${roles.join(", ")}` : ""}`
          })
        : ["- Kein Personal"]),
      "",
    ]),
  )
  if (out.at(-1) === "") out.pop()

  section(
    "Aufgaben",
    sortTasks(operation.tasks).map((t) => {
      const priority = t.priority && t.priority !== "normal" ? ` **${TASK_PRIORITY_LABEL[t.priority]}**` : ""
      const units = unitNames(operation.units, t.unitIds)
      const note = t.note?.trim() ? ` – ${line(t.note)}` : ""
      return `- [${t.done ? "x" : " "}] ${line(t.title)}${priority}${units ? ` → ${units}` : ""}${note}`
    }),
  )

  // Times only, unless the operation went past midnight.
  const days = new Set(operation.log.map((l) => formatDate(l.at)))
  const when = (at: string) => (days.size > 1 ? `${formatDate(at)} ${formatTime(at)}` : formatTime(at))
  section(
    "Verlauf",
    operation.log.map((l) => `- ${when(l.at)} ${l.kind === "notiz" ? "Notiz: " : ""}${line(entryText(l))}`),
  )

  section(
    "Nachbesprechung",
    DEBRIEF_POINTS.filter((p) => operation.debrief[p]?.trim()).map((p) => `- **${p}** ${line(operation.debrief[p])}`),
  )
  return out.join("\n") + "\n"
}
