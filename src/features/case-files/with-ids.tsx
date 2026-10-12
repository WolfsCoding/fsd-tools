import type { ReactNode } from "react"
import { cn } from "cn"
import { looksLikeId } from "./traces"

/** "(D-0042)" behind a name; the ID is captured. */
const ID_IN_PARENS = /\s*\(([^()\s]+)\)/g

/** An ID shown as code. */
export function IdTag({ id }: { id: string }) {
  return <code className="truncate rounded bg-muted px-1 py-px font-mono text-[0.85em] text-foreground">{id}</code>
}

/**
 * `text` with the IDs behind names ("Max Muster (D-0042)") taken out and shown as code on the
 * right, without the parentheses. `children` come before the text, e.g. an icon.
 */
export function WithIds({ text, children, className }: { text: string; children?: ReactNode; className?: string }) {
  const ids: string[] = []
  const rest = text.replace(ID_IN_PARENS, (match, id: string) => {
    if (!looksLikeId(id)) return match
    ids.push(id)
    return ""
  })
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <span className="min-w-0 truncate">
        {children}
        {rest}
      </span>
      {ids.length > 0 && (
        <span className="ml-auto flex shrink-0 gap-1">
          {ids.map((id, i) => (
            <IdTag key={i} id={id} />
          ))}
        </span>
      )}
    </span>
  )
}
