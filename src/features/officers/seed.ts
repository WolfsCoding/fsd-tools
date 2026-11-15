import { POLICE_FILES_KIND, policeFilesAtom } from "@/features/case-files/police-files"
import { collectSuggestions, ownNameAtom, ownRankAtom } from "@/features/case-files/use-case-files"
import type { CaseFile } from "@/features/case-files/types"
import { rosterUnitsAtom, type RosterUnit } from "@/features/operations/roster"
import type { Operation } from "@/features/operations/types"
import { operationsAtom } from "@/features/operations/use-operations"
import { appRegistry } from "@/lib/runtime"
import { readKeys } from "@/lib/storage"
import { sameText, textKey } from "@/lib/text"
import { officersAtom, type Officer } from "./officers"

const NO_ONE = { name: "", rank: "", full: "", department: "" }

/** Everyone entered as an officer in the Akten and the Einsatzleitung, but not the own person. */
export function existingOfficers(caseFiles: CaseFile<string>[], operations: Operation[], own: string[]): string[] {
  const fromCaseFiles = collectSuggestions(caseFiles, "", NO_ONE, POLICE_FILES_KIND.templates).groups.officer.map((s) => s.value)
  const fromOperations = operations.flatMap((o) => [
    o.leitung,
    ...o.patrols.flatMap((p) => p.beamte),
    ...o.people.flatMap((p) => [p.beamter, p.belehrung.belehrtVon, p.belehrung.zeuge]),
    ...(o.leads ?? []).map((l) => l.beamter),
  ])
  const names = new Map<string, string>()
  for (const raw of [...fromCaseFiles, ...fromOperations]) {
    const name = raw.trim()
    if (name && !own.some((o) => o && sameText(o, name)) && !names.has(textKey(name))) names.set(textKey(name), name)
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b, "de"))
}

/** Every unit of the Streifenblätter, still without a vehicle. */
export function existingUnits(operations: Operation[]): Omit<RosterUnit, "id">[] {
  const units = new Map<string, Omit<RosterUnit, "id">>()
  for (const p of operations.flatMap((o) => o.patrols)) {
    const kennung = p.einheit.trim()
    if (kennung && !units.has(textKey(kennung))) units.set(textKey(kennung), { kennung, fahrzeug: "" })
  }
  return [...units.values()].sort((a, b) => a.kennung.localeCompare(b.kennung, "de"))
}

/**
 * Fills the officer list and the units with what was entered before they existed. Runs at
 * startup and only while a list was never saved, so deleted entries don't come back.
 */
function seed() {
  const saved = readKeys([officersAtom.key, rosterUnitsAtom.key])
  const operations = appRegistry.get(operationsAtom)
  if (!(officersAtom.key in saved)) {
    const name = appRegistry.get(ownNameAtom).trim()
    const full = [appRegistry.get(ownRankAtom).trim(), name].filter(Boolean).join(" ")
    const officers: Officer[] = existingOfficers(appRegistry.get(policeFilesAtom), operations, [name, full]).map((n) => ({
      id: crypto.randomUUID(),
      name: n,
    }))
    if (officers.length) appRegistry.set(officersAtom, officers)
  }
  if (!(rosterUnitsAtom.key in saved)) {
    const units = existingUnits(operations).map((u) => ({ id: crypto.randomUUID(), ...u }))
    if (units.length) appRegistry.set(rosterUnitsAtom, units)
  }
}
seed()
