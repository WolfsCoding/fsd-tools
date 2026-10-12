import { toast } from "sonner"

/**
 * The app's one way to confirm a removal: do it right away and offer "Rückgängig"
 * in a toast instead of asking first. `undo` should put the item back where it was.
 */
export function removedToast(label: string, undo: () => void) {
  toast(`${label} gelöscht`, {
    action: { label: "Rückgängig", onClick: undo },
  })
}
