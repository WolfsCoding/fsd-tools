import * as Schema from "effect/Schema"
import type { StoredValue } from "@/lib/storage"

/** A note in Markdown/HTML, on its own or about a person. */
export const Note = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  content: Schema.String,
  /** Rank and name of who wrote it, from the settings. */
  author: Schema.optionalKey(Schema.String),
  /** Folder it sits in under "Notizen"; missing means the top level. */
  folderId: Schema.optionalKey(Schema.String),
  /** Place among the notes and folders next to it, once dragged there. */
  order: Schema.optionalKey(Schema.Number),
  createdAt: Schema.String,
  updatedAt: Schema.String,
})
export type Note = StoredValue<typeof Note>

/** A folder of notes, possibly inside another one. */
export const NoteFolder = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  /** Folder it sits in; missing means the top level. */
  parentId: Schema.optionalKey(Schema.String),
  /** Place among the notes and folders next to it, once dragged there. */
  order: Schema.optionalKey(Schema.Number),
  createdAt: Schema.String,
  updatedAt: Schema.String,
})
export type NoteFolder = StoredValue<typeof NoteFolder>
