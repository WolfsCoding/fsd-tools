import { useMemo } from "react"
import { useCaseFileSummaries } from "@/features/dna-db/case-file-mentions"
import { entryName, useDnaEntries } from "@/features/dna-db/use-dna-entries"

/** Something a todo can be linked to: an Akte or a person. */
export interface LinkOption {
  id: string
  label: string
  /** Shown and searched next to the label, e.g. the DNA-ID. */
  hint?: string
}

/** The one Akte or person a todo is linked to. */
export interface TodoLink {
  kind: "caseFile" | "person"
  id: string
}

/** The link of a todo; older todos could have several, then the first one counts. */
export function todoLink(todo: { caseFileIds?: string[]; personIds?: string[] }): TodoLink | undefined {
  if (todo.caseFileIds?.[0]) return { kind: "caseFile", id: todo.caseFileIds[0] }
  if (todo.personIds?.[0]) return { kind: "person", id: todo.personIds[0] }
}

/** Stores `link` in the id lists of a todo. */
export function linkIds(link: TodoLink | undefined) {
  return {
    caseFileIds: link?.kind === "caseFile" ? [link.id] : [],
    personIds: link?.kind === "person" ? [link.id] : [],
  }
}

/** The Akten and persons to link, newest Akten first. */
export function useLinkOptions() {
  const caseFiles = useCaseFileSummaries()
  const { entries } = useDnaEntries()
  return useMemo(
    () => ({
      caseFiles: [...caseFiles.values()]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((c): LinkOption => ({ id: c.id, label: c.title })),
      persons: entries
        .map((e): LinkOption => ({ id: e.id, label: entryName(e), hint: e.dnaId || e.fingerprintId || undefined }))
        .sort((a, b) => a.label.localeCompare(b.label, "de")),
    }),
    [caseFiles, entries],
  )
}
