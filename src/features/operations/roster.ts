import * as Schema from "effect/Schema"
import { stored, type StoredValue } from "@/lib/storage"

/** A unit's Kennung with the vehicle it drives. */
export const RosterUnit = Schema.Struct({
  id: Schema.String,
  kennung: Schema.String,
  fahrzeug: Schema.String,
})
export type RosterUnit = StoredValue<typeof RosterUnit>

const NO_UNITS: RosterUnit[] = []

export const rosterUnitsAtom = stored("einsatzleitung:einheiten", Schema.Array(RosterUnit), NO_UNITS)
