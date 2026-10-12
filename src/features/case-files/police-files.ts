// Kept apart from use-case-files: the forensic templates import the form, which imports that module.

import { FORENSICS_TEMPLATES, INHERITED } from "@/features/forensics/templates"
import { readKeys, replaceKeys } from "@/lib/local-storage"
import type { CaseFileKind } from "./kind"
import { POLICE_FILES_BASE } from "./paths"
import { isValidSnippets, SNIPPETS_KEY } from "./snippets"
import { TEMPLATES, type Template } from "./templates"
import type { CaseFile } from "./types"
import { isValidCaseFiles, isValidCaseFilesData, useCaseFiles } from "./use-case-files"

export const POLICE_FILES_KEY = "akten:akten"
/** Where the analyses were kept while Forensik was a tab of its own; moved to `POLICE_FILES_KEY` on first load. */
export const LEGACY_FORENSICS_KEY = "forensik:analysen"

/** Akten that collect evidence; the analyses can be attached to them. */
const TAKES_ANALYSES: string[] = ["strafakte", "ermittlungsakte", "sammelakte"]

/** `templates` where the Akten of `TAKES_ANALYSES` can also attach every analysis. */
function withAnalyses(templates: Record<string, Template<string>>) {
  return Object.fromEntries(
    Object.values(templates).map((t) => [
      t.id,
      TAKES_ANALYSES.includes(t.id) ? { ...t, attachable: [...(t.attachable ?? []), ...Object.keys(FORENSICS_TEMPLATES)] } : t,
    ]),
  )
}

/** The police case files and the forensic analyses. */
export const POLICE_FILES_KIND: CaseFileKind = {
  id: "police-files",
  title: "Akten",
  noun: "Akte",
  base: POLICE_FILES_BASE,
  storageKey: POLICE_FILES_KEY,
  templates: { ...withAnalyses(TEMPLATES), ...FORENSICS_TEMPLATES },
  // Only the analyses have these fields; in an Akte they come from the analyses attached before.
  inherit: INHERITED,
  empty: {
    title: "Neue Akte anlegen",
    description:
      "Felder ausfüllen, Werte mit Spanne würfeln, dann das fertige Markdown mit einem Klick kopieren. Leere Felder behalten den Platzhalter der Vorlage, leere Tabellen bleiben leer.",
  },
}

/**
 * Moves the analyses of the former Forensik tab into the Akten. Runs at startup, before
 * anything renders, so old links to an analysis still find it.
 */
function moveLegacyForensics() {
  const stored = readKeys([POLICE_FILES_KEY, LEGACY_FORENSICS_KEY])
  const legacy = stored[LEGACY_FORENSICS_KEY]
  if (legacy === undefined || !isValidCaseFiles(legacy) || !isValidCaseFiles(stored[POLICE_FILES_KEY])) return
  const own = (stored[POLICE_FILES_KEY] as CaseFile<string>[] | undefined) ?? []
  const moved = (legacy as CaseFile<string>[]).filter((a) => !own.some((o) => o.id === a.id))
  replaceKeys([POLICE_FILES_KEY, LEGACY_FORENSICS_KEY], { [POLICE_FILES_KEY]: [...own, ...moved] })
}
moveLegacyForensics()

export function usePoliceFiles() {
  return useCaseFiles(POLICE_FILES_KIND)
}

/** Checks imported data before it replaces the stored case files. */
export function isValidPoliceFilesData(data: Record<string, unknown>) {
  return isValidCaseFilesData(data, [POLICE_FILES_KEY, LEGACY_FORENSICS_KEY]) && isValidSnippets(data[SNIPPETS_KEY])
}
