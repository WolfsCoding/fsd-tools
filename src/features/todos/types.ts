import * as Schema from "effect/Schema"
import type { StoredValue } from "@/lib/storage"

/** Something to do, optionally about Akten and persons of the DNA-DB. Apart from the to-dos inside the Akten. */
export const Todo = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  /** Details from older versions; no longer shown or edited. */
  note: Schema.optionalKey(Schema.String),
  done: Schema.Boolean,
  /** Ids of the Akten it is about. */
  caseFileIds: Schema.optionalKey(Schema.Array(Schema.String)),
  /** Ids of the DNA-DB entries it is about. */
  personIds: Schema.optionalKey(Schema.Array(Schema.String)),
  /** Rank and name of who created it, from the settings. */
  author: Schema.optionalKey(Schema.String),
  createdAt: Schema.String,
  /** When it was ticked off. */
  doneAt: Schema.optionalKey(Schema.String),
})
export type Todo = StoredValue<typeof Todo>

export type TodoInput = Pick<Todo, "title" | "caseFileIds" | "personIds">
