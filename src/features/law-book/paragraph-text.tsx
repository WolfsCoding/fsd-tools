import { useMemo } from "react"
import { CopyIcon } from "lucide-react"
import { cn } from "cn"
import { Hint } from "@/components/hint"
import { Button } from "@/components/ui/button"
import { copy } from "@/lib/clipboard"
import type { Book, Paragraph } from "./data/types"
import { citation, isCitationTerm, isWordTerm } from "./offenses"

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** The text with every occurrence of the search terms marked. */
export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const pattern = useMemo(() => {
    const words = terms.filter((t) => t && !isCitationTerm(t))
    // Short terms like "to" only mark whole words, as they only match those.
    const parts = words.map((w) => (isWordTerm(w) ? String.raw`(?<![\p{L}\p{N}])${escapeRegExp(w)}(?![\p{L}\p{N}])` : escapeRegExp(w)))
    return words.length ? new RegExp(`(${parts.join("|")})`, "iu") : null
  }, [terms])
  if (!pattern) return text
  // split() with a capture group puts the matches at the odd indices.
  return text.split(pattern).map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded-sm bg-amber-400/25 px-0.5 text-foreground">
        {part}
      </mark>
    ) : (
      part
    ),
  )
}

/** "§ 4" in the color of paragraph numbers. */
export function ParagraphNumber({ number, className }: { number: number; className?: string }) {
  return <span className={cn("font-semibold whitespace-nowrap text-amber-400", className)}>§ {number}</span>
}

/** Amounts of money in the law's wording, e.g. "3.500 bis 6.500 Dollar" or "25 $". */
const AMOUNT = /((?:\d{1,3}(?:\.\d{3})+|\d+)\s*(?:Dollar\s*)?(?:bis\s*(?:\d{1,3}(?:\.\d{3})+|\d+)\s*)?(?:Dollar|\$))/

/** The text with its amounts of money colored and the search terms marked. */
export function LawText({ text, terms }: { text: string; terms: string[] }) {
  // split() with a capture group puts the amounts at the odd indices.
  return text.split(AMOUNT).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="font-medium text-amber-300">
        <Highlight text={part} terms={terms} />
      </span>
    ) : (
      <Highlight key={i} text={part} terms={terms} />
    ),
  )
}

/**
 * Icon button that copies a citation like "§ 14 Abs. 3 TO". With `onHover` it only shows
 * on hover of its `group/cite` row, or when focused. It sits above stretched card links.
 */
export function CopyCitation({ text, onHover = true, className }: { text: string; onHover?: boolean; className?: string }) {
  return (
    <Hint label="Zitat kopieren">
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => copy(text, "Zitat")}
        aria-label={`Zitat kopieren: ${text}`}
        className={cn(
          "relative z-10 text-muted-foreground hover:text-foreground",
          onHover && "opacity-0 group-hover/cite:opacity-100 focus-visible:opacity-100",
          className,
        )}
      >
        <CopyIcon />
      </Button>
    </Hint>
  )
}

/**
 * The sections of a paragraph, numbered like "(1)", with their amounts of money colored.
 * `active` emphasizes one section, e.g. the charged one, and dims the others. With `book`,
 * each section gets a button copying its citation.
 */
export function ParagraphText({
  paragraph,
  book,
  active,
  terms = [],
  className,
}: {
  paragraph: Paragraph
  book?: Book
  active?: number
  terms?: string[]
  className?: string
}) {
  return (
    <ol className={cn("space-y-2 leading-relaxed", className)}>
      {paragraph.sections.map((section, i) => (
        <li
          key={i}
          className={cn(
            "group/cite flex gap-2",
            active !== undefined && (active === i ? "text-foreground" : "text-muted-foreground/70"),
          )}
        >
          <span className="shrink-0 font-medium text-muted-foreground">({i + 1})</span>
          <span className="min-w-0 flex-1 whitespace-pre-line">
            <LawText text={section} terms={terms} />
          </span>
          {book && <CopyCitation text={citation(book, paragraph, i)} className="-my-0.5 shrink-0" />}
        </li>
      ))}
    </ol>
  )
}
