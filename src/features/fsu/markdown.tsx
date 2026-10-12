import { useMemo } from "react"
import ReactMarkdown, { type Options } from "react-markdown"
import { Link } from "react-router"
import remarkGfm from "remark-gfm"
import { cn } from "cn"
import { remarkHighlight, remarkLawLinks } from "./remark-plugins"

type PluggableList = NonNullable<Options["remarkPlugins"]>

/**
 * Renders post Markdown (GFM: tables, task lists, strikethrough). Raw HTML is not rendered.
 * Law citations link to the Gesetzbuch.
 */
export function Markdown({
  children,
  className,
  headingIds,
  highlight = "",
}: {
  children: string
  className?: string
  /** Anchor ids by source line, so the table of contents can link to headings. */
  headingIds?: Map<number, string>
  /** Search term to mark in the text. */
  highlight?: string
}) {
  const idOf = (node?: { position?: { start: { line: number } } }) =>
    node?.position && headingIds?.get(node.position.start.line)
  const plugins = useMemo<PluggableList>(() => [remarkGfm, remarkLawLinks, [remarkHighlight, highlight]], [highlight])

  return (
    <div
      className={cn(
        "prose prose-sm max-w-none prose-invert prose-neutral",
        "prose-headings:scroll-mt-4 prose-headings:font-semibold prose-h2:mt-8 prose-h2:border-b prose-h2:pb-2 prose-h2:text-lg prose-h3:text-base",
        "prose-a:text-sidebar-primary prose-a:no-underline hover:prose-a:underline",
        "prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:font-normal prose-code:before:content-none prose-code:after:content-none",
        "prose-pre:border prose-pre:bg-muted/50",
        "prose-blockquote:border-l-sidebar-primary prose-blockquote:font-normal prose-blockquote:text-muted-foreground prose-blockquote:not-italic [&_blockquote_p]:before:content-none [&_blockquote_p]:after:content-none",
        "prose-table:text-sm prose-th:bg-muted/50 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-hr:border-border",
        "[&_mark]:rounded-sm [&_mark]:bg-sidebar-primary/30 [&_mark]:text-foreground",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={plugins}
        components={{
          // Paths are in-app links (e.g. to the Gesetzbuch); the rest open in a new tab.
          a: ({ node: _node, href, ...props }) =>
            href?.startsWith("/") ? (
              <Link to={href} {...props} />
            ) : (
              <a href={href} {...props} target="_blank" rel="noreferrer" />
            ),
          h2: ({ node, ...props }) => <h2 {...props} id={idOf(node) || undefined} />,
          h3: ({ node, ...props }) => <h3 {...props} id={idOf(node) || undefined} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
