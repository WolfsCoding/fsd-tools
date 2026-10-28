import { CopyIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { MarkdownText, Shortcut } from "@/features/case-files/case-file-view"
import { copy } from "@/lib/clipboard"

/** The ticket as it will be pasted; Ctrl+C or the button copies it. */
export function TicketDialog({ markdown, onClose }: { markdown: string | undefined; onClose: () => void }) {
  const copyTicket = () => markdown && copy(markdown, "Ticket")
  return (
    <Dialog open={!!markdown} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100svh-4rem)] pb-0 sm:max-w-5xl"
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "c" && !window.getSelection()?.toString()) {
            e.preventDefault()
            copyTicket()
          }
        }}
      >
        <DialogTitle className="sr-only">Ticket</DialogTitle>
        <DialogDescription className="sr-only">So wird das Ticket eingefügt.</DialogDescription>
        <div className="flex min-h-0 flex-1 rounded-xl bg-card p-1 ring-1 ring-border">
          <MarkdownText text={markdown ?? ""} />
        </div>
        <div className="flex h-14 shrink-0 items-center gap-5 px-3.5 text-sm text-muted-foreground">
          <span className="min-w-0 flex-1 truncate">
            {(markdown ?? "").split("\n").length.toLocaleString("de-DE")} Zeilen Markdown
          </span>
          <Shortcut keys={["Strg", "C"]}>Kopieren</Shortcut>
          <Button size="sm" onClick={copyTicket}>
            <CopyIcon /> Kopieren
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
