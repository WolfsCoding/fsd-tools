import { useState, type KeyboardEvent, type MouseEvent } from "react"
import { cn } from "cn"

/**
 * Edits a short text in place, e.g. after a double click. Enter or leaving the field
 * saves, Escape cancels; `onDone` gets `undefined` when nothing should change.
 */
export function InlineEdit({
  value,
  onDone,
  multiline = false,
  allowEmpty = false,
  placeholder,
  className,
  "aria-label": ariaLabel,
}: {
  value: string
  onDone: (value: string | undefined) => void
  /** Allows line breaks with Shift+Enter. */
  multiline?: boolean
  /** Lets the user clear the text; otherwise an empty field counts as "no change". */
  allowEmpty?: boolean
  placeholder?: string
  className?: string
  "aria-label": string
}) {
  const [draft, setDraft] = useState(value)
  const next = draft.trim()
  const finish = () => onDone((next || allowEmpty) && next !== value.trim() ? next : undefined)
  const props = {
    autoFocus: true,
    placeholder,
    value: draft,
    "aria-label": ariaLabel,
    onBlur: finish,
    // The field may sit inside a toggle or link; clicks and keys must not reach it.
    onClick: (e: MouseEvent) => e.stopPropagation(),
    onDoubleClick: (e: MouseEvent) => e.stopPropagation(),
    onKeyDown: (e: KeyboardEvent) => {
      e.stopPropagation()
      if (e.key === "Enter" && !(multiline && e.shiftKey)) {
        e.preventDefault()
        finish()
      } else if (e.key === "Escape") onDone(undefined)
    },
    onKeyUp: (e: KeyboardEvent) => e.preventDefault(),
    className: cn("-mx-1 w-full min-w-0 rounded-sm bg-background px-1 ring-2 ring-ring/50 outline-none", className),
  }
  return multiline ? (
    <textarea
      {...props}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      className={cn(props.className, "field-sizing-content resize-none")}
    />
  ) : (
    <input {...props} onChange={(e) => setDraft(e.target.value)} onFocus={(e) => e.currentTarget.select()} />
  )
}
