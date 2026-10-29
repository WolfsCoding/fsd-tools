import { useState } from "react"
import { ClipboardCopyIcon, PlusIcon } from "lucide-react"
import { EXPLORER_CARD, EXPLORER_CARDS } from "@/components/explorer"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { copy } from "@/lib/clipboard"
import { MarkdownText, Shortcut } from "./case-file-view"
import type { CaseFileKind } from "./kind"
import { blankMarkdown, type Template } from "./templates"
import { useColors, useOwnIdentity } from "./use-case-files"

/** The empty templates of a kind under one heading; each opens as its bare markdown, as kept in the editor. */
export function TemplateList({
  kind,
  templates,
  onCreate,
}: {
  kind: CaseFileKind
  /** From `searchTemplates`; nothing is shown without any. */
  templates: Template<string>[]
  onCreate: (template: string) => void
}) {
  const [openId, setOpenId] = useState<string>()
  const { identity } = useOwnIdentity()
  const { colors } = useColors()

  const open = openId ? kind.templates[openId] : undefined
  const markdown = open ? blankMarkdown(open, colors, identity.department) : ""
  const copyOpen = () => open && copy(markdown, `Vorlage ${open.label}`)

  return (
    <>
      {templates.length > 0 && (
        <section className="grid gap-1.5">
          <h3 className="px-1 text-xs font-medium text-muted-foreground">Vorlagen</h3>
          <div className={EXPLORER_CARDS}>
            {templates.map((t) => (
              <button key={t.id} type="button" onClick={() => setOpenId(t.id)} className={`${EXPLORER_CARD} text-left`}>
                <span className="text-sm font-medium">
                  <span aria-hidden>{t.emoji}</span> {t.label}
                </span>
                <span className="text-xs text-muted-foreground">{t.description}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpenId(undefined)}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[calc(100svh-4rem)] pb-0 sm:max-w-5xl"
          onKeyDown={(e) => {
            // Ctrl/⌘+C copies the whole template, unless some text is selected.
            if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "c" && !window.getSelection()?.toString()) {
              e.preventDefault()
              copyOpen()
            }
          }}
        >
          <DialogTitle className="sr-only">Vorlage: {open?.label}</DialogTitle>
          <DialogDescription className="sr-only">Das leere Template als Markdown.</DialogDescription>
          <div className="flex min-h-0 flex-1 rounded-xl bg-card p-1 ring-1 ring-border">
            <MarkdownText text={markdown} />
          </div>
          <div className="flex h-14 shrink-0 items-center gap-3 px-3.5 text-sm text-muted-foreground">
            <span className="min-w-0 flex-1 truncate">
              <span aria-hidden>{open?.emoji}</span> {open?.label} · {markdown.split("\n").length.toLocaleString("de-DE")}{" "}
              Zeilen Markdown
            </span>
            <span className="hidden sm:contents">
              <Shortcut keys={["Strg", "C"]}>Kopieren</Shortcut>
            </span>
            {open?.standalone && (
              <Button variant="outline" size="sm" onClick={() => onCreate(open.id)}>
                <PlusIcon /> Neue {kind.noun}
              </Button>
            )}
            <Button size="sm" onClick={copyOpen}>
              <ClipboardCopyIcon /> Kopieren
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
