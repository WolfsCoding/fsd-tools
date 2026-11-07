import { cn } from "cn"
import { Markdown } from "@/features/fsu/markdown"

// Pasted reports: thick dividers, a plain line before quotes, and tables with framed cells
// whose rows alternate between two shades.
const REPORT = cn(
  "prose-p:my-2 prose-img:my-2 prose-img:inline-block prose-code:text-[0.8em]",
  "prose-hr:my-5 prose-hr:border-t-[3px] prose-hr:border-muted-foreground/25",
  "prose-blockquote:my-3 prose-blockquote:border-l-[3px] prose-blockquote:border-l-muted-foreground/25 prose-blockquote:pl-4 prose-blockquote:text-foreground",
  "prose-table:my-3 prose-table:border-separate prose-table:border-spacing-0 prose-table:overflow-hidden prose-table:rounded-md prose-table:ring-1 prose-table:ring-border",
  "prose-th:border-r prose-th:border-b prose-th:border-border prose-th:bg-muted/70 prose-th:py-2.5 prose-th:align-middle prose-th:text-foreground",
  "prose-td:border-r prose-td:border-b prose-td:border-border prose-td:py-2 prose-td:align-middle",
  "[&_tbody_tr:nth-child(odd)]:bg-muted/20 [&_tbody_tr:nth-child(even)]:bg-muted/50",
  "[&_td:last-child]:border-r-0 [&_th:last-child]:border-r-0 [&_tbody_tr:last-child>td]:border-b-0",
)

/** A note's Markdown/HTML as a report: dividers, quote lines and two-shaded tables. */
export function NoteMarkdown({ children, className }: { children: string; className?: string }) {
  return (
    <Markdown html className={cn(REPORT, className)}>
      {children}
    </Markdown>
  )
}
