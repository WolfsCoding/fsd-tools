// Which Akten mention an entry. Read straight from the stored case files, so the DNA-DB only
// depends on their storage key, their shape and how their titles are made.

import { useAtomValue } from "@effect/atom-react"
import { useMemo } from "react"
import { POLICE_FILES_KIND, policeFilesAtom } from "@/features/case-files/police-files"
import type { CaseFile } from "@/features/case-files/types"
import { caseFileTitle, useOwnName } from "@/features/case-files/use-case-files"
import { textKey } from "@/lib/text"
import type { DnaEntry } from "./types"

const NO_MENTIONS: CaseFileMention[] = []

export interface CaseFileMention {
  id: string
  title: string
}

/**
 * Every text entered in a value: plain text, list items, table cells, and the IDs and names of
 * the traces kept as JSON in a cell.
 */
function texts(value: unknown, out: string[]) {
  if (typeof value === "string") {
    const text = value.trim()
    if (text.startsWith("[")) {
      try {
        texts(JSON.parse(text), out)
        return
      } catch {
        // Not JSON after all: plain text.
      }
    }
    if (text) out.push(text)
  } else if (Array.isArray(value)) {
    for (const v of value) texts(v, out)
  } else if (typeof value === "object" && value !== null) {
    for (const v of Object.values(value)) texts(v, out)
  }
}

/** The Akte's title as the case files show it. */
export function caseFileMentionTitle(caseFile: CaseFile<string>, me: string) {
  // Its main document may be of a template that was removed since.
  if (!POLICE_FILES_KIND.templates[caseFile.docs[0]?.template]) return caseFile.title.trim() || "Akte"
  return caseFileTitle(caseFile, me, POLICE_FILES_KIND.templates)
}

/**
 * The Akten each entry is mentioned in, by entry id: where its DNA-ID, fingerprint ID or name
 * was entered as a whole field, cell or trace, the way the case files link them.
 */
export function useCaseFileMentions(entries: DnaEntry[]) {
  const caseFiles = useAtomValue(policeFilesAtom)
  const me = useOwnName()

  return useMemo(() => {
    // Each entered text with the Akten it was entered in, in their order.
    const byText = new Map<string, CaseFileMention[]>()
    for (const caseFile of caseFiles) {
      const found: string[] = []
      for (const doc of caseFile.docs) texts(doc.values, found)
      const mention = { id: caseFile.id, title: caseFileMentionTitle(caseFile, me) }
      for (const key of new Set(found.map(textKey))) {
        const list = byText.get(key)
        if (list) list.push(mention)
        else byText.set(key, [mention])
      }
    }

    const result = new Map<string, CaseFileMention[]>()
    for (const entry of entries) {
      const mentions = new Map<string, CaseFileMention>()
      for (const value of [entry.dnaId, entry.fingerprintId, entry.name]) {
        if (!value.trim()) continue
        for (const m of byText.get(textKey(value)) ?? []) mentions.set(m.id, m)
      }
      if (mentions.size) result.set(entry.id, [...mentions.values()])
    }
    return result
  }, [caseFiles, entries, me])
}

export interface CaseFileSummary extends CaseFileMention {
  createdAt: string
  settled: boolean
}

/** Every Akte with its title as the case files show it, by id. */
export function useCaseFileSummaries() {
  const caseFiles = useAtomValue(policeFilesAtom)
  const me = useOwnName()
  return useMemo(
    () =>
      new Map<string, CaseFileSummary>(
        caseFiles.map((c) => [
          c.id,
          { id: c.id, title: caseFileMentionTitle(c, me), createdAt: c.createdAt, settled: !!c.settled },
        ]),
      ),
    [caseFiles, me],
  )
}

/** The mentions of one entry from `useCaseFileMentions`. */
export function mentionsOf(mentions: Map<string, CaseFileMention[]>, entry: DnaEntry) {
  return mentions.get(entry.id) ?? NO_MENTIONS
}
