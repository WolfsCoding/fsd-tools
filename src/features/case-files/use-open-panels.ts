import { useCallback } from "react"
import { useLocalStorage } from "@/lib/local-storage"

// Which sections and foldable fields of a document are open, by document id. Kept across
// tabs and reloads; it's only how the form looks, so it isn't part of the backups.
const OPEN_PANELS_KEY = "case-files:open-panels"
const EMPTY: Record<string, string[]> = {}

/**
 * The open panels of document `docId` and a setter; `initial` while none were toggled yet.
 * Sections are named by their index, fields by `field:<key>`.
 */
export function useOpenPanels(docId: string, initial: string[]) {
  const [all, setAll] = useLocalStorage(OPEN_PANELS_KEY, EMPTY)
  const open = all[docId] ?? initial
  const setOpen = useCallback(
    (next: string[]) => setAll((prev) => ({ ...prev, [docId]: next })),
    [docId, setAll],
  )
  return [open, setOpen] as const
}
