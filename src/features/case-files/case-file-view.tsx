import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useSearchParams } from "react-router"
import {
  CircleCheckIcon,
  ClipboardCopyIcon,
  CopyIcon,
  DicesIcon,
  EllipsisIcon,
  EyeIcon,
  FileTextIcon,
  HeadingIcon,
  PanelRightIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { BackButton } from "@/components/explorer"
import { Hint } from "@/components/hint"
import { InlineEdit } from "@/components/inline-edit"
import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { useDnaEntries } from "@/features/dna-db/use-dna-entries"
import { useTabTitle } from "@/hooks/use-tabs"
import { copy } from "@/lib/clipboard"
import { formatRelative } from "@/lib/format-date"
import { useAtom } from "@effect/atom-react"
import * as Schema from "effect/Schema"
import { stored } from "@/lib/storage"
import { removedToast } from "@/lib/undo"
import { DocForm, MeHint } from "./doc-form"
import { withNow } from "./markdown"
import type { CaseFileKind } from "./kind"
import { blankMarkdown, canRandomize, createReader, missingRequired, randomized } from "./templates"
import type { CaseFile, Doc } from "./types"
import {
  caseFileTitle,
  collectSuggestions,
  docLabel,
  docName,
  useColors,
  useOwnIdentity,
  type CaseFilesApi,
} from "./use-case-files"
import { WithIds } from "./with-ids"

// Whether the markdown is shown next to the form on wide screens. Only how the page looks,
// so it isn't part of the backups.
const previewSideAtom = stored("case-files:preview-side", Schema.Boolean, false)

/** Drafts left just now, deleted unless they are opened again right away (StrictMode mounts twice). */
const pendingDiscards = new Map<string, ReturnType<typeof setTimeout>>()

/** Whether a key event is Alt+Shift+`code` on its own; AltGr (Ctrl+Alt on Windows) types characters instead. */
function isAltShift(e: KeyboardEvent, code: string) {
  return e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.getModifierState("AltGraph") && e.code === code
}

/** Copies `text`; with required fields still empty, one warning naming them replaces the usual confirmation. */
function copyChecked(text: string, label: string, missing: string[]) {
  if (!missing.length) return copy(text, label)
  navigator.clipboard.writeText(text).then(
    () => toast.warning(`${label} kopiert, Pflichtfelder leer`, { description: missing.join(", ") }),
    () => toast.error("Kopieren nicht möglich"),
  )
}

/** One case file: a tab per document and its form. The markdown opens on demand or stays next to the form. */
export function CaseFileView({
  kind,
  caseFile,
  api,
  onDelete,
}: {
  kind: CaseFileKind
  caseFile: CaseFile<string>
  api: CaseFilesApi
  onDelete: (caseFile: CaseFile<string>) => void
}) {
  const templates = kind.templates
  const { identity } = useOwnIdentity()
  const me = identity.full
  // The open document is part of the URL, so reloading and going back keep it.
  const [params, setParams] = useSearchParams()
  const setDocId = (id: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (id === caseFile.docs[0].id) next.delete("doc")
        else next.set("doc", id)
        return next
      },
      { replace: true },
    )
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewSide, setPreviewSide] = useAtom(previewSideAtom)
  // The list's context menu opens a case file with `{ preview: true }` to show its preview right away.
  // Handled once per navigation, while rendering (no effect needed).
  const location = useLocation()
  const [handledKey, setHandledKey] = useState<string>()
  if (location.key !== handledKey) {
    setHandledKey(location.key)
    if ((location.state as { preview?: boolean } | null)?.preview) setPreviewOpen(true)
  }
  // A case file just created (`{ created: true }`) or a document just added starts in its first field.
  const formRef = useRef<HTMLDivElement>(null)
  /** The document whose first field takes the focus once it is shown. */
  const focusDoc = useRef((location.state as { created?: boolean } | null)?.created ? caseFile.docs[0].id : undefined)
  /** "caseFile" or the id of the document whose title is being edited. */
  const [renaming, setRenaming] = useState<string>()
  const renameAfterMenu = useRef(false)
  const title = caseFileTitle(caseFile, me, templates)
  useTabTitle(title)

  const docIndex = Math.max(0, caseFile.docs.findIndex((d) => d.id === params.get("doc")))
  const current = caseFile.docs[docIndex]
  const template = templates[current.template]
  const main = templates[caseFile.docs[0].template]
  const { colors } = useColors()
  const { entries: dnaEntries } = useDnaEntries()
  const readerOf = (d: Doc<string>) =>
    createReader(templates[d.template], d.values, me, colors, identity.department, dnaEntries)
  const reader = useMemo(
    () => createReader(template, current.values, me, colors, identity.department, dnaEntries),
    [template, current.values, me, colors, identity.department, dnaEntries],
  )
  const markdown = useMemo(() => template.render(reader), [template, reader])
  // Templates without a title of their own use the case file's title (main document) or the document's name.
  const pageTitle =
    template.pageTitle?.(reader) ?? (docIndex === 0 ? title : docName(current, me, templates, caseFile.docs))
  const suggestions = useMemo(
    () => collectSuggestions(api.caseFiles, caseFile.id, identity, templates),
    [api.caseFiles, caseFile.id, identity, templates],
  )
  const label = docLabel(current, me, templates, caseFile.docs)
  // Automatic dates are the time of copying; the preview shows them as they would be now.
  const preview = withNow(markdown)
  const copyMarkdown = () => copyChecked(withNow(markdown), label, missingRequired(template, reader))
  /** The main document and every attached one as one text, in tab order. */
  const copyAll = () =>
    copyChecked(
      withNow(caseFile.docs.map((d) => templates[d.template].render(readerOf(d))).join("\n\n")),
      "Alle Dokumente",
      caseFile.docs.flatMap((d) =>
        missingRequired(templates[d.template], readerOf(d)).map((f) => `${docName(d, me, templates, caseFile.docs)}: ${f}`),
      ),
    )
  /** The empty template of the open document, without the own name; its `{{now:…}}` dates stay for the editor to fill in. */
  const copyBlank = () => {
    if (!template.blank) return
    copy(blankMarkdown(template, colors, identity.department), "Vorlage")
  }
  const showTabs = caseFile.docs.length > 1 || !!main.attachable

  // Alt+Shift+C copies the page title, with or without the preview open.
  useEffect(() => {
    if (!pageTitle) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (isAltShift(e, "KeyC")) {
        e.preventDefault()
        copy(pageTitle, "Titel")
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [pageTitle])

  useEffect(() => {
    if (focusDoc.current !== current.id) return
    focusDoc.current = undefined
    formRef.current?.querySelector<HTMLElement>("input, textarea")?.focus()
  })

  // A new case file nothing was entered in yet is deleted once it is left: another one is
  // opened, the tab is closed or the page reloaded.
  const { discardDraft } = api
  useEffect(() => {
    const id = caseFile.id
    clearTimeout(pendingDiscards.get(id))
    const discard = () => discardDraft(id)
    window.addEventListener("pagehide", discard)
    return () => {
      window.removeEventListener("pagehide", discard)
      pendingDiscards.set(id, setTimeout(discard))
    }
  }, [discardDraft, caseFile.id])

  /** Rolls every random value of the document again; the toast can undo it. */
  function randomize() {
    const changed = randomized(template, current.values)
    const before = Object.fromEntries(Object.keys(changed).map((k) => [k, current.values[k] ?? ""]))
    api.setValues(caseFile.id, current.id, changed)
    toast("Werte neu gewürfelt", {
      action: { label: "Rückgängig", onClick: () => api.setValues(caseFile.id, current.id, before) },
    })
  }

  function addDoc(id: string) {
    const added = api.addDoc(caseFile.id, id)
    focusDoc.current = added
    setDocId(added)
  }

  function removeDoc(removed: Doc<string>) {
    const index = caseFile.docs.indexOf(removed)
    api.removeDoc(caseFile.id, removed.id)
    if (removed.id === current.id) setDocId(caseFile.docs[0].id)
    removedToast(`„${docLabel(removed, me, templates, caseFile.docs)}"`, () => api.restoreDoc(caseFile.id, removed, index))
  }

  // Where the group changes (e.g. the analyses after the statements of an Akte), it gets its own heading.
  const attachItems = main.attachable?.flatMap((id, i, ids) => {
    const group = templates[id].group
    const item = (
      <DropdownMenuItem key={id} onSelect={() => addDoc(id)}>
        <span aria-hidden>{templates[id].emoji}</span> {templates[id].menuLabel ?? templates[id].label}
      </DropdownMenuItem>
    )
    if (i === 0 || group === templates[ids[i - 1]].group) return [item]
    return [
      <DropdownMenuSeparator key={`${id}:separator`} />,
      <DropdownMenuLabel key={`${id}:label`}>{group ?? kind.title}</DropdownMenuLabel>,
      item,
    ]
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className={cn("border-b px-6 pt-5", !showTabs && "pb-4")}>
        <div className="flex items-center gap-3">
          <BackButton to={kind.base} label={`Alle ${kind.title}`} />
          <div className="grid min-w-0 flex-1 gap-0.5">
            <p className="truncate text-xs text-muted-foreground">
              {main.label} · geändert {formatRelative(caseFile.updatedAt)}
              {caseFile.settled && <span className="font-medium text-emerald-400"> · Erledigt</span>}
            </p>
            {renaming === "caseFile" ? (
              // Clearing the title goes back to the automatic one.
              <InlineEdit
                value={title}
                allowEmpty
                onDone={(t) => {
                  if (t !== undefined) api.rename(caseFile.id, t)
                  setRenaming(undefined)
                }}
                placeholder={caseFileTitle({ ...caseFile, title: "" }, me, templates)}
                aria-label={`Titel der ${kind.noun}`}
                className="text-xl font-semibold"
              />
            ) : (
              <Hint label="Doppelklick zum Umbenennen">
                <h1
                  onDoubleClick={() => setRenaming("caseFile")}
                  className="truncate text-xl font-semibold select-none"
                >
                  <WithIds text={title} />
                </h1>
              </Hint>
            )}
          </div>
          {canRandomize(template) && (
            <Hint label="Alle Werte mit Spanne zufällig innerhalb der Spanne neu würfeln">
              <Button variant="outline" size="sm" onClick={randomize}>
                <DicesIcon /> Würfeln
              </Button>
            </Hint>
          )}
          {template.blank && (
            <Hint label="Das leere Template mit dem Vorlagen-Titel kopieren">
              <Button variant="outline" size="sm" onClick={copyBlank}>
                <FileTextIcon /> Vorlage kopieren
              </Button>
            </Hint>
          )}
          <Button size="sm" onClick={copyMarkdown}>
            <ClipboardCopyIcon /> Kopieren
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Weitere Aktionen">
                <EllipsisIcon />
              </Button>
            </DropdownMenuTrigger>
            {/* "Umbenennen" opens the title field once the menu is closed, so the field gets the focus, not the button. */}
            <DropdownMenuContent
              align="end"
              className="w-60"
              onCloseAutoFocus={(e) => {
                if (!renameAfterMenu.current) return
                renameAfterMenu.current = false
                e.preventDefault()
                setRenaming("caseFile")
              }}
            >
              <DropdownMenuItem onSelect={() => setPreviewOpen(true)}>
                <EyeIcon /> Vorschau
              </DropdownMenuItem>
              <DropdownMenuCheckboxItem
                checked={previewSide}
                onCheckedChange={setPreviewSide}
                className="hidden xl:flex"
              >
                <PanelRightIcon /> Vorschau neben dem Formular
              </DropdownMenuCheckboxItem>
              {pageTitle && (
                <DropdownMenuItem onSelect={() => copy(pageTitle, "Titel")}>
                  <HeadingIcon /> Seitentitel kopieren
                </DropdownMenuItem>
              )}
              {caseFile.docs.length > 1 && (
                <DropdownMenuItem onSelect={copyAll}>
                  <CopyIcon /> Alle Dokumente kopieren
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => (renameAfterMenu.current = true)}>
                <PencilIcon /> {kind.noun} umbenennen
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => api.setSettled(caseFile.id, !caseFile.settled)}>
                <CircleCheckIcon /> {caseFile.settled ? "Als offen markieren" : "Als erledigt markieren"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {docIndex > 0 && (
                <DropdownMenuItem variant="destructive" onSelect={() => removeDoc(current)}>
                  <Trash2Icon /> Dokument entfernen
                </DropdownMenuItem>
              )}
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(caseFile)}>
                <Trash2Icon /> {kind.noun} löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {showTabs && (
          <div
            role="tablist"
            aria-label="Dokumente der Akte"
            className="-mx-3 mt-3 flex items-center gap-0.5 no-scrollbar overflow-x-auto"
          >
            {caseFile.docs.map((d) =>
              renaming === d.id ? (
                <span key={d.id} className="shrink-0 px-3 pt-1 pb-2">
                  <InlineEdit
                    value={docName(d, me, templates)}
                    allowEmpty
                    onDone={(t) => {
                      if (t !== undefined) api.renameDoc(caseFile.id, d.id, t)
                      setRenaming(undefined)
                    }}
                    aria-label="Titel des Dokuments"
                    className="w-48 text-sm"
                  />
                </span>
              ) : (
                <ContextMenu key={d.id}>
                  <Hint label="Doppelklick oder F2 zum Umbenennen">
                    <ContextMenuTrigger asChild>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={d.id === current.id}
                        onClick={() => setDocId(d.id)}
                        onDoubleClick={() => setRenaming(d.id)}
                        onKeyDown={(e) => {
                          if (e.key === "F2") {
                            e.preventDefault()
                            setRenaming(d.id)
                          }
                        }}
                        className={cn(
                          "relative max-w-60 shrink-0 truncate px-3 pt-1.5 pb-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                          d.id === current.id &&
                            "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-foreground",
                        )}
                      >
                        <WithIds text={docLabel(d, me, templates, caseFile.docs)} />
                      </button>
                    </ContextMenuTrigger>
                  </Hint>
                  {/* Not refocusing the tab keeps the focus in the title field after "Umbenennen". */}
                  <ContextMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
                    <ContextMenuItem
                      onSelect={() => {
                        setDocId(d.id)
                        setPreviewOpen(true)
                      }}
                    >
                      <EyeIcon /> Vorschau
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => setRenaming(d.id)}>
                      <PencilIcon /> Umbenennen
                    </ContextMenuItem>
                    {d.id !== caseFile.docs[0].id && (
                      <ContextMenuItem variant="destructive" onSelect={() => removeDoc(d)}>
                        <Trash2Icon /> Entfernen
                      </ContextMenuItem>
                    )}
                  </ContextMenuContent>
                </ContextMenu>
              ),
            )}
            {attachItems && (
              <DropdownMenu>
                <Hint label="Dokument hinzufügen">
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="xs" className="mb-1 ml-1 shrink-0 text-muted-foreground">
                      <PlusIcon /> Neues Dokument
                    </Button>
                  </DropdownMenuTrigger>
                </Hint>
                {/* The new document's first field keeps the focus, not the button. */}
                <DropdownMenuContent align="start" className="w-60" onCloseAutoFocus={(e) => e.preventDefault()}>
                  <DropdownMenuLabel>Zur Akte hinzufügen</DropdownMenuLabel>
                  {attachItems}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="relative min-h-0 min-w-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="grid gap-4">
            <MeHint me={reader.me} />
            {/* Keyed by document, so switching documents fades the new one in. */}
            <div key={current.id} ref={formRef} className="animate-in duration-200 ease-out-quint fade-in-0 slide-in-from-bottom-1">
              <DocForm
                template={template}
                values={current.values}
                reader={reader}
                onChange={(key, value) => api.setValue(caseFile.id, current.id, key, value)}
                onUpdate={(key, fn) => api.updateValue(caseFile.id, current.id, key, fn)}
                suggestions={suggestions}
                docId={current.id}
              />
            </div>
          </div>
        </main>
        {/* Next to the form only where there is room; narrower screens open the preview as a dialog. */}
        {previewSide && (
          <aside
            aria-label="Vorschau"
            className="hidden w-[42%] max-w-3xl shrink-0 flex-col border-l animate-in duration-300 ease-out-quint fade-in-0 slide-in-from-right-6 xl:flex"
          >
            <div className="flex h-11 shrink-0 items-center gap-2 border-b pr-2 pl-4 text-xs text-muted-foreground">
              <span className="min-w-0 flex-1 truncate">
                Vorschau · {preview.split("\n").length.toLocaleString("de-DE")} Zeilen Markdown
              </span>
              <Hint label="Vorschau ausblenden">
                <Button variant="ghost" size="icon-xs" aria-label="Vorschau ausblenden" onClick={() => setPreviewSide(false)}>
                  <XIcon />
                </Button>
              </Hint>
            </div>
            <MarkdownText text={preview} />
          </aside>
        )}
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[calc(100svh-4rem)] pb-0 sm:max-w-5xl"
          onKeyDown={(e) => {
            // Ctrl/⌘+C copies the whole document, unless some text is selected.
            // Alt+Shift+C (the title) is handled for the whole page.
            if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "c" && !window.getSelection()?.toString()) {
              e.preventDefault()
              copyMarkdown()
            }
          }}
        >
          <DialogTitle className="sr-only">{label}</DialogTitle>
          <DialogDescription className="sr-only">So wird das Dokument eingefügt.</DialogDescription>
          {/* The text scrolls inside the panel's padding, so the rounded corners never clip the scrollbar. */}
          <div className="flex min-h-0 flex-1 rounded-xl bg-card p-1 ring-1 ring-border">
            <MarkdownText text={preview} />
          </div>
          {/* Like the command palette's footer: what is shown, and the keys that act on it. */}
          <div className="flex h-14 shrink-0 items-center gap-5 px-3.5 text-sm text-muted-foreground">
            <span className="min-w-0 flex-1 truncate">
              {preview.split("\n").length.toLocaleString("de-DE")} Zeilen Markdown
            </span>
            {pageTitle && <Shortcut keys={["Alt", "Umschalt", "C"]}>Titel kopieren</Shortcut>}
            <Shortcut keys={["Strg", "C"]}>Kopieren</Shortcut>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** The markdown as it will be pasted. */
export function MarkdownText({ text }: { text: string }) {
  return (
    <pre className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5 font-mono text-xs/relaxed break-words whitespace-pre-wrap text-muted-foreground">
      {text}
    </pre>
  )
}

export function Shortcut({ keys, children }: { keys: string[]; children: string }) {
  return (
    <span className="flex shrink-0 items-center gap-2 font-medium">
      <KbdGroup>
        {keys.map((k) => (
          <Kbd key={k} className="h-7 min-w-7 border bg-card px-2 text-sm">
            {k}
          </Kbd>
        ))}
      </KbdGroup>
      {children}
    </span>
  )
}
