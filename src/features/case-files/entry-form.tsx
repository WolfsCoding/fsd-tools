import { useId, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BLOCKS_KEY, BlockEditor } from "./block-editor"
import { markdownBlocks, writeBlocks } from "./blocks"
import type { DocFormProps } from "./templates"
import { useColors } from "./use-case-files"

/** An own entry while it is edited: title and blocks. */
export function EntryForm({ values, onChange, onUpdate, onEditingChange }: DocFormProps) {
  const { colors } = useColors()
  const str = (key: string) => (typeof values[key] === "string" ? (values[key] as string) : "")
  const title = str("titel")
  const id = useId()
  // Entries written before the block editor, or imported, start from the blocks of their Markdown.
  const [seed] = useState(() => writeBlocks(markdownBlocks(str("text"), () => crypto.randomUUID(), colors.heading)))

  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor={`${id}-title`}>Titel</Label>
        <Input id={`${id}-title`} value={title} onChange={(e) => onChange("titel", e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label>Text</Label>
        <div
          onKeyDown={(e) => {
            if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey)) return
            e.preventDefault()
            onEditingChange?.(false)
          }}
        >
          <BlockEditor values={{ ...values, [BLOCKS_KEY]: values[BLOCKS_KEY] ?? seed }} onChange={onChange} onUpdate={onUpdate} />
        </div>
        <p className="text-xs text-muted-foreground">„/“ fügt einen Block ein · Strg+Enter beendet die Bearbeitung</p>
      </div>
    </>
  )
}
