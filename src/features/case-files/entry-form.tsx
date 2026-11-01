import { useId } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MarkdownEditor } from "@/features/notes/markdown-editor"
import type { DocFormProps } from "./templates"

/** An own entry while it is edited: title and text, written like a note. */
export function EntryForm({ values, onChange, onEditingChange }: DocFormProps) {
  const str = (key: string) => (typeof values[key] === "string" ? (values[key] as string) : "")
  const title = str("titel")
  const text = str("text")
  const id = useId()

  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-title`}>Titel</Label>
        <Input id={`${id}-title`} value={title} onChange={(e) => onChange("titel", e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-text`}>Text</Label>
        <MarkdownEditor
          id={`${id}-text`}
          value={text}
          onChange={(v) => onChange("text", v)}
          onSubmit={() => onEditingChange?.(false)}
        />
        <p className="text-xs text-muted-foreground">
          Dieses Eingabefeld unterstützt Markdown und ein paar HTML-Tags · Strg+Enter beendet die Bearbeitung
        </p>
      </div>
    </>
  )
}
