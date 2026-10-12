import { ClipboardCopyIcon, FolderOpenIcon, FolderPlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@/components/ui/dialog"
import type { useCollectiveFile } from "./collective-file"
import { DEBRIEF_POINTS } from "./guide"
import { QuietField } from "./panel"
import type { Operation } from "./types"
import type { useOperations } from "./use-operations"

type Api = ReturnType<typeof useOperations>

/** One field per point of the guide's debrief. Stays editable after the operation is locked. */
export function DebriefFields({ operation, api }: { operation: Operation; api: Api }) {
  return DEBRIEF_POINTS.map((p) => (
    <label key={p} className="grid gap-1 px-4 py-3">
      <span className="text-xs font-medium text-muted-foreground">{p}</span>
      <QuietField
        value={operation.debrief[p] ?? ""}
        onChange={(v) => api.setDebrief(operation.id, p, v)}
        readOnly={false}
        placeholder="Notizen…"
      />
    </label>
  ))
}

/** The short debrief offered right after finishing an operation. */
export function DebriefDialog({
  operation,
  api,
  open,
  onOpenChange,
  onCopyReport,
  collectiveFile,
}: {
  operation: Operation
  api: Api
  open: boolean
  onOpenChange: (open: boolean) => void
  onCopyReport: () => void
  /** The operation's Sammelakte, offered once the debrief is written. */
  collectiveFile: ReturnType<typeof useCollectiveFile>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogPanel className="max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nachbesprechung</DialogTitle>
            <DialogDescription>
              Halte kurz fest, wie der Einsatz ausgegangen ist. Die Notizen landen im Bericht und bleiben im Reiter
              „Lage“.
            </DialogDescription>
          </DialogHeader>
          <div className="divide-y rounded-lg border">
            <DebriefFields operation={operation} api={api} />
          </div>
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" onClick={onCopyReport}>
            <ClipboardCopyIcon /> Bericht kopieren
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              collectiveFile.open()
            }}
          >
            {collectiveFile.exists ? <FolderOpenIcon /> : <FolderPlusIcon />}
            {collectiveFile.exists ? "Sammelakte öffnen" : "Sammelakte anlegen"}
          </Button>
          <DialogClose asChild>
            <Button>Fertig</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
