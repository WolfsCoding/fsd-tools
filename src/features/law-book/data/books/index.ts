import type { Book } from "../types"
import { civilProcedures } from "./civil-procedures"
import { criminalOffenses } from "./criminal-offenses"
import { lawProcedures } from "./law-procedures"
import { ticketOffenses } from "./ticket-offenses"

/** Every law book, sorted by title. A new book gets its own file and an entry here. */
export const books = [
  civilProcedures,
  criminalOffenses,
  lawProcedures,
  ticketOffenses,
] as const satisfies readonly Book[]

export type BookId = (typeof books)[number]["id"]
