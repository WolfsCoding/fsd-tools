import { useNavigate } from "react-router"
import { toast } from "sonner"
import { caseFilePath } from "@/features/case-files/paths"
import { usePoliceFiles } from "@/features/case-files/police-files"
import type { Values } from "@/features/case-files/types"
import { formatTime } from "./format"
import { DEBRIEF_POINTS, FACTOR_LABEL } from "./guide"
import { line } from "./report"
import { LAGE_FACTORS, type Operation } from "./types"
import { leadMember, unitName, type useOperations } from "./use-operations"

type Api = ReturnType<typeof useOperations>

/** Template of the case file an operation becomes. */
const TEMPLATE = "sammelakte"

/** Debrief points that belong in the Akte: who was arrested or hurt and the evidence. */
const CASE_POINTS = DEBRIEF_POINTS.slice(0, 3)

/** An ISO time as the value of a datetime-local input, in local time. */
function localDateTime(iso: string) {
  const d = new Date(iso)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

/** The lines of a text, without empty ones. */
const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)

/**
 * What the Sammelakte takes over from an operation: place and start, the EL, the Lage as
 * Tathergang, and the units, the debrief on arrests, injuries and evidence and the notes
 * under "Sonstiges". Fields without a match keep their template value.
 */
export function collectiveFileValues(operation: Operation): Values {
  const values: Values = { datum: localDateTime(operation.createdAt) }
  if (operation.location.trim()) values.tatort = line(operation.location)
  // Without a picked EL the user leads, which the field fills in by itself.
  const el = leadMember(operation, "el")
  if (el) values.leitung = el.member.name.trim()

  const tathergang = [
    ...lines(operation.situation),
    operation.involved.trim() && `Beteiligte: ${line(operation.involved)}`,
    ...LAGE_FACTORS.filter((f) => operation.factors[f].state === "ja").map((f) => {
      const note = operation.factors[f].note.trim()
      return `${FACTOR_LABEL[f]}: ja${note ? ` – ${line(note)}` : ""}`
    }),
  ].filter((s): s is string => !!s)
  if (tathergang.length) values.tathergang = tathergang

  const sonstiges = [
    ...operation.units.map((u) => {
      const names = u.members.map((m) => m.name.trim()).filter(Boolean)
      return `Streife ${unitName(u)}${names.length ? `: ${names.join(", ")}` : ""}`
    }),
    ...CASE_POINTS.filter((p) => operation.debrief[p]?.trim()).map((p) => `${p} ${line(operation.debrief[p])}`),
    ...operation.log.filter((l) => l.kind === "notiz").map((l) => `${formatTime(l.at)} Uhr: ${line(l.text)}`),
  ]
  if (sonstiges.length) values.sonstiges = sonstiges
  return values
}

/**
 * The Sammelakte of an operation: whether it still exists, and opening it, or creating it
 * prefilled from the operation first.
 */
export function useCollectiveFile(operation: Operation, api: Api) {
  const { caseFiles, createCaseFile } = usePoliceFiles()
  const navigate = useNavigate()
  // A deleted Akte can be created again.
  const exists = !!operation.caseFileId && caseFiles.some((a) => a.id === operation.caseFileId)

  function open() {
    if (exists && operation.caseFileId) {
      navigate(caseFilePath(operation.caseFileId))
      return
    }
    const id = createCaseFile(TEMPLATE, collectiveFileValues(operation))
    api.setCaseFile(operation.id, id)
    toast.success("Sammelakte angelegt", { description: "Ort, Zeit, Lage, Streifen und Notizen aus dem Einsatz sind eingetragen." })
    navigate(caseFilePath(id))
  }

  return { exists, open }
}
