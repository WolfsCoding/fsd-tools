import * as Schema from "effect/Schema"
import type { StoredValue } from "@/lib/storage"

/** Not checked yet, registered, not registered for the road (Kennung ZZ), or not checkable. */
export const PlateStatus = Schema.Literals(["offen", "gueltig", "ungueltig", "nicht_pruefbar"])
export type PlateStatus = typeof PlateStatus.Type

/** A plate seen at a scene, to be checked against the registry. */
export const PlateCheck = Schema.Struct({
  id: Schema.String,
  driver: Schema.String,
  /** Added later, so stored rows may lack it. */
  holder: Schema.optionalKey(Schema.String),
  model: Schema.String,
  plate: Schema.String,
  /** When it was seen, as in a datetime-local input ("2026-10-02T14:30"). */
  date: Schema.String,
  scene: Schema.String,
  status: PlateStatus,
  createdAt: Schema.String,
})
export type PlateCheck = StoredValue<typeof PlateCheck>

export type PlateCheckInput = Pick<PlateCheck, "driver" | "holder" | "model" | "plate" | "date" | "scene">
