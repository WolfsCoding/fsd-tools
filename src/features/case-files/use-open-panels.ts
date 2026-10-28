import { useAtom } from "@effect/atom-react"
import * as Schema from "effect/Schema"
import { useCallback } from "react"
import { stored } from "@/lib/storage"

// Which sections and foldable fields of a document are open, by document id. Kept across
// tabs and reloads; it's only how the form looks, so it isn't part of the backups.
const OPEN_PANELS_KEY = "case-files:open-panels"
const EMPTY: Record<string, string[]> = {}

const openPanelsAtom = stored(OPEN_PANELS_KEY, Schema.Record(Schema.String, Schema.Array(Schema.String)), EMPTY)

/**
 * The open panels of document `docId` and a setter; `initial` while none were toggled yet.
 * Sections are named by their index, fields by `field:<key>`.
 */
export function useOpenPanels(docId: string, initial: string[]) {
  const [all, setAll] = useAtom(openPanelsAtom)
  const open = all[docId] ?? initial
  const setOpen = useCallback(
    (next: string[]) => setAll((prev) => ({ ...prev, [docId]: next })),
    [docId, setAll],
  )
  return [open, setOpen] as const
}
