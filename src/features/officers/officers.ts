import { useMemo } from "react"
import { useAtomValue } from "@effect/atom-react"
import * as Schema from "effect/Schema"
import { stored, type StoredValue } from "@/lib/storage"

/** An officer of the own list, suggested wherever an officer is entered. */
export const Officer = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
})
export type Officer = StoredValue<typeof Officer>

const NO_OFFICERS: Officer[] = []

export const officersAtom = stored("officers", Schema.Array(Officer), NO_OFFICERS)

/** The names of the own officer list, without empty ones. */
export function useOfficerNames() {
  const officers = useAtomValue(officersAtom)
  return useMemo(() => officers.map((o) => o.name.trim()).filter(Boolean), [officers])
}
