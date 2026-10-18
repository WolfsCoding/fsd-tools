import type { Template } from "./templates"

/**
 * One kind of case files with its own templates and storage, e.g. the Akten with the
 * forensic analyses. The list, the editor and the storage work the same for every kind.
 */
export interface CaseFileKind {
  /** Prefix of its command palette entries, e.g. "police-files". */
  id: string
  /** Title of the list, e.g. "Akten". */
  title: string
  /** One case file, e.g. "Akte" ("Neue Akte", "Titel der Akte"). */
  noun: string
  /** Route prefix; must match the feature's `path` in the registry. */
  base: string
  /** localStorage key of its case files. */
  storageKey: string
  templates: Record<string, Template<string>>
  /** Values a newly attached document takes over from the main one, e.g. the case number. */
  inherit?: string[]
  /** Shown while no case file is open. */
  empty: { title: string; description: string }
}

/** Templates a new case file can start from, in menu order. */
export function standaloneTemplates(kind: CaseFileKind) {
  return Object.values(kind.templates).filter((t) => t.standalone)
}

/** `standaloneTemplates` under their headings, e.g. "Akten" and "Forensik"; templates without a group go under the kind's title. */
export function templateGroups(kind: CaseFileKind) {
  const groups = new Map<string, Template<string>[]>()
  for (const t of standaloneTemplates(kind)) {
    const label = t.group ?? kind.title
    groups.set(label, [...(groups.get(label) ?? []), t])
  }
  return [...groups].map(([label, templates]) => ({ label, templates }))
}

export function casePath(kind: CaseFileKind, id: string) {
  return `${kind.base}/${id}`
}

/**
 * Every template of the kind matching the search: the standalone ones in menu order, then the
 * ones that are only attached.
 */
export function searchTemplates(kind: CaseFileKind, query: string) {
  const q = query.trim().toLowerCase()
  const all = [
    ...templateGroups(kind).flatMap((g) => g.templates),
    ...Object.values(kind.templates).filter((t) => !t.standalone),
  ]
  return q
    ? all.filter((t) =>
        [t.group ?? kind.title, t.label, t.menuLabel ?? "", t.description].some((s) => s.toLowerCase().includes(q)),
      )
    : all
}
