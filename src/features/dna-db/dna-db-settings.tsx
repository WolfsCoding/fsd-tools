import { count } from "@/lib/text"
import { useDnaEntries } from "./use-dna-entries"

/** What the DNA-DB stores, for its row in the settings. */
export function DnaDbSummary() {
  const { entries } = useDnaEntries()
  return count(entries.length, "Eintrag", "Einträge")
}
