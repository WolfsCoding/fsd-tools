import type { TemplateId } from "./templates"

/** One row of a table field, by column key. */
export type Row = Record<string, string>

/** Text for text fields, checked options for checklists, rows for tables. */
export type Value = string | string[] | Row[]
export type Values = Record<string, Value>

/** One document of a case file, filled from a template. */
export interface Doc<Id extends string = TemplateId> {
  id: string
  template: Id
  /** Set when renamed; otherwise the tab shows who or what the document is about. */
  title?: string
  values: Values
}

/** A case file: its main document plus attached ones (e.g. one report per suspect). */
export interface CaseFile<Id extends string = TemplateId> {
  id: string
  /** Set when renamed; otherwise the list shows a title derived from the main document. */
  title: string
  /** The first one is the main document and can't be removed. */
  docs: Doc<Id>[]
  /** Marked as done; still listed, after the open ones. */
  settled?: boolean
  createdAt: string
  updatedAt: string
}
