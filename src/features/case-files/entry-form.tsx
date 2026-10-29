import { useId, useState } from "react"
import { CheckIcon, PencilIcon } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MarkdownEditor, NoteMarkdown } from "@/features/notes/markdown-editor"
import type { DocFormProps } from "./templates"

/** An own entry, shown like a note: its Markdown rendered, and title and text while it is edited. */
export function EntryForm({ values, onChange }: DocFormProps) {
  const str = (key: string) => (typeof values[key] === "string" ? (values[key] as string) : "")
  const title = str("titel")
  const text = str("text")
  // A new entry has nothing to show yet, so it starts in the editor.
  const [editing, setEditing] = useState(() => !title.trim() && !text.trim())
  const id = useId()

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center gap-2 bg-card py-2.5 pr-3 pl-4">
        <span className={cn("min-w-0 flex-1 truncate text-lg font-semibold", !title.trim() && "text-muted-foreground italic")}>
          {title.trim() || "Ohne Titel"}
        </span>
        {editing ? (
          <Button size="sm" onClick={() => setEditing(false)}>
            <CheckIcon /> Fertig
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <PencilIcon /> Bearbeiten
          </Button>
        )}
      </div>
      {editing ? (
        <div className="grid gap-4 border-t p-4">
          <div className="grid gap-2">
            <Label htmlFor={`${id}-title`}>Titel</Label>
            <Input id={`${id}-title`} value={title} onChange={(e) => onChange("titel", e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-text`}>Text</Label>
            <MarkdownEditor id={`${id}-text`} value={text} onChange={(v) => onChange("text", v)} onSubmit={() => setEditing(false)} />
            <p className="text-xs text-muted-foreground">
              Dieses Eingabefeld unterstützt Markdown und ein paar HTML-Tags · Strg+Enter beendet die Bearbeitung
            </p>
          </div>
        </div>
      ) : text.trim() ? (
        <NoteMarkdown className="border-t px-4 py-5">{text}</NoteMarkdown>
      ) : (
        <p className="border-t px-4 py-5 text-sm text-muted-foreground italic">Leerer Eintrag</p>
      )}
    </div>
  )
}
