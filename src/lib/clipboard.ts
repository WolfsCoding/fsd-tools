import { toast } from "sonner"

/** Copies `text` and confirms with a toast, e.g. `copy(md, "Markdown")` → "Markdown kopiert". */
export async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} kopiert`)
  } catch {
    toast.error("Kopieren nicht möglich")
  }
}
