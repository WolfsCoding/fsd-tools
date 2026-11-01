import type { DnaEntry } from "@/features/dna-db/types"
import { PERSON } from "./templates"
import { lookupLabel } from "./traces"
import type { CaseFile } from "./types"

/** A type of case file, as in the department's records system. */
export interface CaseType {
  id: string
  label: string
  /** Front of its Aktenzeichen, e.g. "Js" in "Js 18970/26"; "" for none. */
  prefix: string
  /** The template of its Beschreibung. */
  template: string
}

export const CASE_TYPES: CaseType[] = [
  { id: "js", label: "Strafakte", prefix: "Js", template: "strafakte" },
  { id: "e", label: "Ermittlungsakte", prefix: "E", template: "ermittlungsakte" },
  { id: "v", label: "Verwaltungsakte", prefix: "V", template: "verwaltungsakte" },
  { id: "sa", label: "Sammelakte", prefix: "Sa", template: "sammelakte" },
  { id: "speed", label: "Speedingticket", prefix: "Speed", template: "geschwindigkeit" },
  // Its Beschreibung is built from blocks.
  { id: "eigene", label: "Eigene", prefix: "", template: "eigene" },
]

export function caseType(id: string) {
  return CASE_TYPES.find((t) => t.id === id)
}

/** The type of a case file; older ones take it from the template of their Beschreibung. */
export function caseTypeOf(caseFile: CaseFile<string>) {
  return caseType(caseFile.type ?? "") ?? CASE_TYPES.find((t) => t.template === caseFile.docs[0]?.template)
}

/** The Ablage as the DNA database knows them, e.g. "Ryan Shaw (D-0042)"; "" without one. */
export function ablageLabel(caseFile: CaseFile<string>, entries: DnaEntry[]) {
  return caseFile.ablage ? lookupLabel({ ablage: caseFile.ablage }, "ablage", PERSON, entries) : ""
}

/** The case number behind its type's prefix, e.g. "Js 18970/26"; "" without a number. */
export function aktenzeichen(caseFile: CaseFile<string>) {
  const number = caseFile.caseNumber?.trim() ?? ""
  const prefix = caseTypeOf(caseFile)?.prefix
  if (!number || !prefix || number.toLowerCase().startsWith(`${prefix.toLowerCase()} `)) return number
  return `${prefix} ${number}`
}
