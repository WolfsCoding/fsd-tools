import { useId } from "react"
import { MarkdownEditor } from "@/features/notes/markdown-editor"
import { FULL, Labeled } from "./doc-form"
import type { CustomFieldProps } from "./templates"

/** Free Markdown, written like a note and copied as it is. */
export function MarkdownField({ field, values, onChange }: CustomFieldProps) {
  const id = useId()
  const value = values[field.key]
  return (
    <Labeled id={id} label={field.label} hint="Markdown und ein paar HTML-Tags" required={field.required} className={FULL}>
      <MarkdownEditor id={id} value={typeof value === "string" ? value : ""} onChange={(v) => onChange(field.key, v)} />
    </Labeled>
  )
}
