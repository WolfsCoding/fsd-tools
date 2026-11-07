import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useLocation, useSearchParams } from "react-router"
import {
  CheckIcon,
  ClipboardCopyIcon,
  CopyIcon,
  DicesIcon,
  EllipsisIcon,
  EyeIcon,
  FilePlusIcon,
  FileTextIcon,
  FolderDownIcon,
  GripVerticalIcon,
  HeadingIcon,
  PencilIcon,
  PlayIcon,
  Trash2Icon,
  UserIcon,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { BackButton } from "@/components/explorer"
import { Hint } from "@/components/hint"
import { InlineEdit } from "@/components/inline-edit"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { useReorder } from "@/components/use-reorder"
import { useDnaEntries } from "@/features/dna-db/use-dna-entries"
import { NoteMarkdown } from "@/features/notes/markdown-editor"
import { useRegisterCommands, type CommandGroupDef } from "@/hooks/use-command-palette"
import { useTabTitle } from "@/hooks/use-tabs"
import { copy } from "@/lib/clipboard"
import { formatDate, formatLongDateTime, formatRelative } from "@/lib/format-date"
import { removedToast } from "@/lib/undo"
import { saveFolder } from "@/lib/folder"
import { ablagePerson, aktenzeichen, caseTypeOf } from "./case-types"
import { DocForm, MeHint, SectionFields } from "./doc-form"
import { EditCaseFileDialog } from "./edit-case-file-dialog"
import { withNow } from "./markdown"
import type { CaseFileKind } from "./kind"
import { blankMarkdown, canRandomize, createReader, missingRequired, randomized, type Section } from "./templates"
import { StatusBadge } from "./status-badge"
import { statusOf, type CaseFile, type Doc } from "./types"
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

/** Whether a key event is Alt+Shift+`code` on its own; AltGr (Ctrl+Alt on Windows) types characters instead. */
function isAltShift(e: KeyboardEvent, code: string) {
  return e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.getModifierState("AltGraph") && e.code === code
}

/**
 * Whether the page has room for the Markdown next to the form. Measured on the page itself,
 * since a split view halves it on a wide window.
 */
function useRoomForSide() {
  const [room, setRoom] = useState(() => window.innerWidth >= 1280)
  const ref = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setRoom(entry.contentRect.width >= 1152))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, room] as const
}

/** Copies `text`; with required fields still empty, one warning naming them replaces the usual confirmation. */
function copyChecked(text: string, label: string, missing: string[]) {
  if (!missing.length) return copy(text, label)
  navigator.clipboard.writeText(text).then(
    () => toast.warning(`${label} kopiert, Pflichtfelder leer`, { description: missing.join(", ") }),
    () => toast.error("Kopieren nicht möglich"),
  )
}

/** What can be done with a Bericht; shown in its context menu and its ⋯ menu. */
interface DocAction {
  label: string
  icon: LucideIcon
  onSelect: () => void
  destructive?: boolean
}

/**
 * One case file, like in the records system: its details in the header, the Beschreibung (the
 * main document) with the Berichte (the attached ones) below it, and a tab per part kept beside
 * them, e.g. the Tatbestände.
 */
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
  const main = caseFile.docs[0]
  const mainTemplate = templates[main.template]
  const reports = caseFile.docs.slice(1)

  // The open tab is part of the URL, so reloading and going back keep it.
  const [params, setParams] = useSearchParams()
  const tabs = mainTemplate.sections.filter((s) => s.tab)
  const tab = tabs.find((s) => s.title === params.get("tab"))
  const setTab = (next: Section | undefined) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next) p.set("tab", next.title)
        else p.delete("tab")
        return p
      },
      { replace: true },
    )

  const [expanded, setExpanded] = useState<string[]>([])
  const toggle = (id: string) => setExpanded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  /** The documents being edited; the others show their Markdown (see `locked`). */
  const [editing, setEditing] = useState<string[]>([])
  const setEditingOf = (id: string, on: boolean) => {
    setEditing((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)))
    if (on) setExpanded((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }
  /** The Bericht to scroll to once it is shown, and whether its first field takes the focus. */
  const [reveal, setReveal] = useState<{ id: string; focus: boolean }>()
  const bodyRef = useRef<HTMLDivElement>(null)

  /** The document shown in the preview dialog. */
  const [previewId, setPreviewId] = useState<string>()
  const reorder = useReorder((from, to) => api.moveDoc(caseFile.id, from + 1, to + 1))
  const [pageRef, roomForSide] = useRoomForSide()

  // Handled while rendering (no effect needed): the list's context menu opens a case file with
  // `{ preview: true }` to show its preview right away, and links to a Bericht (`?doc=`) open it.
  const location = useLocation()
  const [handledKey, setHandledKey] = useState<string>()
  if (location.key !== handledKey) {
    setHandledKey(location.key)
    if ((location.state as { preview?: boolean } | null)?.preview) setPreviewId(main.id)
  }
  const linked = params.get("doc")
  const [handledDoc, setHandledDoc] = useState<string | null>(null)
  if (linked !== handledDoc) {
    setHandledDoc(linked)
    if (linked && reports.some((d) => d.id === linked)) {
      setExpanded((prev) => (prev.includes(linked) ? prev : [...prev, linked]))
      setReveal({ id: linked, focus: false })
    }
  }

  /** The id of the Bericht whose title is being edited. */
  const [renaming, setRenaming] = useState<string>()
  const [editingDetails, setEditingDetails] = useState(false)
  const addedFromMenu = useRef(false)
  const title = caseFileTitle(caseFile, me, templates)
  useTabTitle(title)
  const type = caseTypeOf(caseFile)
  const number = aktenzeichen(caseFile)

  const { colors } = useColors()
  const { entries: dnaEntries } = useDnaEntries()
  const ablage = ablagePerson(caseFile, dnaEntries)
  const readerOf = useCallback(
    (d: Doc<string>) => createReader(templates[d.template], d.values, me, colors, identity.department, dnaEntries),
    [templates, me, colors, identity.department, dnaEntries],
  )
  const mainReader = useMemo(() => readerOf(main), [readerOf, main])
  const mainMarkdown = useMemo(() => mainTemplate.render(mainReader), [mainTemplate, mainReader])
  const suggestions = useMemo(
    () => collectSuggestions(api.caseFiles, caseFile.id, identity, templates),
    [api.caseFiles, caseFile.id, identity, templates],
  )

  const nameOf = (d: Doc<string>) => (d === main ? "Beschreibung" : docLabel(d, me, templates, caseFile.docs))
  /** The title the records system wants for a document, e.g. "🟣 Aussage: …"; the case file's for the Beschreibung. */
  const titleOf = (d: Doc<string>) =>
    templates[d.template].pageTitle?.(readerOf(d)) ?? (d === main ? title : docName(d, me, templates, caseFile.docs))
  const markdownOf = (d: Doc<string>) => (d === main ? mainMarkdown : templates[d.template].render(readerOf(d)))
  const copyDoc = (d: Doc<string>) =>
    copyChecked(withNow(markdownOf(d)), nameOf(d), missingRequired(templates[d.template], d === main ? mainReader : readerOf(d)))
  /** The Beschreibung and every Bericht as one text, in their order. */
  const copyAll = () =>
    copyChecked(
      withNow(caseFile.docs.map(markdownOf).join("\n\n")),
      "Alle Dokumente",
      caseFile.docs.flatMap((d) => missingRequired(templates[d.template], readerOf(d)).map((f) => `${nameOf(d)}: ${f}`)),
    )
  /** Every document as its own Markdown file, numbered in their order, in a folder named like the case file. */
  const saveAsFolder = () =>
    saveFolder(
      title,
      caseFile.docs.map((d, i) => ({
        name: `${String(i + 1).padStart(2, "0")} ${d === main ? "Beschreibung" : docName(d, me, templates, caseFile.docs)}.md`,
        text: withNow(markdownOf(d)),
      })),
    )
  /** The empty template of a document, without the own name; its `{{now:…}}` dates stay for the editor to fill in. */
  const copyBlank = (d: Doc<string>) => copy(blankMarkdown(templates[d.template], colors, identity.department), "Vorlage")

  const previewDoc = caseFile.docs.find((d) => d.id === previewId)
  const preview = previewDoc ? withNow(markdownOf(previewDoc)) : ""

  // The palette and the shortcut run the latest actions, but are registered again only when their labels change.
  const latest = useRef({ copyMain: () => copyDoc(main), copyAll, shownTitle: () => titleOf(previewDoc ?? main) })
  useEffect(() => {
    latest.current = { copyMain: () => copyDoc(main), copyAll, shownTitle: () => titleOf(previewDoc ?? main) }
  })
  const several = caseFile.docs.length > 1
  const commandGroups = useMemo<CommandGroupDef[]>(
    () => [
      {
        heading: title,
        items: [
          { id: `${kind.id}:open:copy`, label: "Beschreibung kopieren", icon: ClipboardCopyIcon, onSelect: () => latest.current.copyMain() },
          { id: `${kind.id}:open:preview`, label: "Vorschau: Beschreibung", icon: EyeIcon, onSelect: () => setPreviewId(main.id) },
          ...(several
            ? [{ id: `${kind.id}:open:copy-all`, label: "Alle Dokumente kopieren", icon: CopyIcon, onSelect: () => latest.current.copyAll() }]
            : []),
        ],
      },
    ],
    [title, several, kind.id, main.id, setPreviewId],
  )
  useRegisterCommands(`${kind.id}:open`, commandGroups)

  // Alt+Shift+C copies the title of the previewed document, else the case file's.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isAltShift(e, "KeyC")) return
      e.preventDefault()
      copy(latest.current.shownTitle(), "Titel")
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  // Each reveal is a new object, so it runs once per Bericht added or linked to.
  useEffect(() => {
    const el = reveal && bodyRef.current?.querySelector<HTMLElement>(`[data-doc-id="${reveal.id}"]`)
    if (!reveal || !el) return
    el.scrollIntoView({ block: "nearest" })
    if (reveal.focus) el.querySelector<HTMLElement>("[data-doc-body] :is(input, textarea)")?.focus()
  }, [reveal])

  /** Rolls every random value of the document again; the toast can undo it. */
  function randomize(d: Doc<string>) {
    const changed = randomized(templates[d.template], d.values)
    const before = Object.fromEntries(Object.keys(changed).map((k) => [k, d.values[k] ?? ""]))
    api.setValues(caseFile.id, d.id, changed)
    toast("Werte neu gewürfelt", {
      action: { label: "Rückgängig", onClick: () => api.setValues(caseFile.id, d.id, before) },
    })
  }

  function addDoc(id: string) {
    const added = api.addDoc(caseFile.id, id)
    setExpanded((prev) => [...prev, added])
    setEditingOf(added, true)
    setReveal({ id: added, focus: true })
    addedFromMenu.current = true
  }

  function removeDoc(removed: Doc<string>) {
    const index = caseFile.docs.indexOf(removed)
    api.removeDoc(caseFile.id, removed.id)
    removedToast(`„${docLabel(removed, me, templates, caseFile.docs)}“`, () => api.restoreDoc(caseFile.id, removed, index))
  }

  // Where the group changes (e.g. the analyses after the statements), it gets its own heading.
  const attachItems = mainTemplate.attachable?.flatMap((id, i, ids) => {
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

  /** The Beschreibung and every Bericht show their Markdown until "Bearbeiten". */
  const locked = (d: Doc<string>) => !editing.includes(d.id)

  const editButton = (d: Doc<string>) =>
    editing.includes(d.id) ? (
      <Button variant="outline" size="sm" onClick={() => setEditingOf(d.id, false)}>
        <CheckIcon /> Fertig
      </Button>
    ) : (
      <Button variant="outline" size="sm" onClick={() => setEditingOf(d.id, true)}>
        <PencilIcon /> Bearbeiten
      </Button>
    )

  function rendered(d: Doc<string>) {
    const markdown = withNow(markdownOf(d)).trim()
    return markdown ? <NoteMarkdown>{markdown}</NoteMarkdown> : <p className="text-sm text-muted-foreground italic">Noch leer</p>
  }

  function formOf(d: Doc<string>) {
    const t = templates[d.template]
    if (locked(d)) return rendered(d)
    const onChange = (key: string, value: Doc<string>["values"][string]) => api.setValue(caseFile.id, d.id, key, value)
    const onUpdate = (key: string, fn: Parameters<CaseFilesApi["updateValue"]>[3]) => api.updateValue(caseFile.id, d.id, key, fn)
    if (t.form) return <t.form values={d.values} onChange={onChange} onUpdate={onUpdate} onEditingChange={(on) => setEditingOf(d.id, on)} />
    return (
      <DocForm
        template={t}
        values={d.values}
        reader={d === main ? mainReader : readerOf(d)}
        onChange={onChange}
        onUpdate={onUpdate}
        suggestions={suggestions}
        docId={d.id}
      />
    )
  }

  const docActions = (d: Doc<string>): DocAction[] => {
    const t = templates[d.template]
    return [
      { label: "Vorschau", icon: EyeIcon, onSelect: () => setPreviewId(d.id) },
      ...(t.pageTitle ? [{ label: "Titel kopieren", icon: HeadingIcon, onSelect: () => copy(titleOf(d), "Titel") }] : []),
      { label: "Umbenennen", icon: PencilIcon, onSelect: () => setRenaming(d.id) },
      ...(canRandomize(t) ? [{ label: "Würfeln", icon: DicesIcon, onSelect: () => randomize(d) }] : []),
      ...(t.blank ? [{ label: "Vorlage kopieren", icon: FileTextIcon, onSelect: () => copyBlank(d) }] : []),
      { label: "Entfernen", icon: Trash2Icon, onSelect: () => removeDoc(d), destructive: true },
    ]
  }

  const report = (d: Doc<string>, i: number) => {
    const t = templates[d.template]
    const open = expanded.includes(d.id)
    return (
      <Collapsible
        key={d.id}
        open={open}
        data-doc-id={d.id}
        {...reorder.row(i)}
        className={cn("overflow-hidden rounded-lg border", reorder.rowClass(i))}
      >
        <ContextMenu>
          <div className="flex items-center gap-1 bg-card pr-2 transition-colors hover:bg-accent/30">
            {reports.length > 1 && (
              <Hint label="Ziehen zum Sortieren, oder Pfeil hoch/runter">
                <button
                  type="button"
                  aria-label={`„${docName(d, me, templates)}“ verschieben`}
                  {...reorder.handle(i)}
                  onKeyDown={(e) => {
                    const to = e.key === "ArrowUp" ? i - 1 : e.key === "ArrowDown" ? i + 1 : undefined
                    if (to === undefined) return
                    e.preventDefault()
                    if (to >= 0 && to < reports.length) api.moveDoc(caseFile.id, i + 1, to + 1)
                  }}
                  className="ml-1.5 flex h-8 w-5 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing"
                >
                  <GripVerticalIcon className="size-3.5" />
                </button>
              </Hint>
            )}
            {renaming === d.id ? (
              <div className="min-w-0 flex-1 py-3 pl-4">
                {/* Clearing the title goes back to the automatic one. */}
                <InlineEdit
                  value={docName(d, me, templates)}
                  allowEmpty
                  onDone={(name) => {
                    if (name !== undefined) api.renameDoc(caseFile.id, d.id, name)
                    setRenaming(undefined)
                  }}
                  aria-label="Titel des Berichts"
                  className="w-full max-w-md text-base font-semibold"
                />
              </div>
            ) : (
              <ContextMenuTrigger asChild>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => toggle(d.id)}
                  onKeyDown={(e) => {
                    if (e.key !== "F2") return
                    e.preventDefault()
                    setRenaming(d.id)
                  }}
                  className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <PlayIcon className={cn("size-2.5 shrink-0 fill-current transition-transform", open && "rotate-90")} />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="truncate text-base font-semibold">
                      <WithIds text={docLabel(d, me, templates, caseFile.docs)} />
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {t.label}
                      {d.createdAt && ` · ${formatLongDateTime(d.createdAt)}`}
                    </span>
                  </span>
                </button>
              </ContextMenuTrigger>
            )}
            {editButton(d)}
            <Button variant="ghost" size="sm" onClick={() => copyDoc(d)}>
              <ClipboardCopyIcon /> Kopieren
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Weitere Aktionen für „${docName(d, me, templates)}“`}>
                  <EllipsisIcon />
                </Button>
              </DropdownMenuTrigger>
              {/* Not refocusing the button keeps the focus in the title field after "Umbenennen". */}
              <DropdownMenuContent align="end" className="w-52" onCloseAutoFocus={(e) => e.preventDefault()}>
                {docActions(d).map((x) => (
                  <DropdownMenuItem key={x.label} variant={x.destructive ? "destructive" : undefined} onSelect={x.onSelect}>
                    <x.icon /> {x.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <ContextMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
            {docActions(d).map((x) => (
              <ContextMenuItem key={x.label} variant={x.destructive ? "destructive" : undefined} onSelect={x.onSelect}>
                <x.icon /> {x.label}
              </ContextMenuItem>
            ))}
          </ContextMenuContent>
        </ContextMenu>
        <CollapsibleContent>
          <div data-doc-body className="grid gap-4 border-t p-4">
            {formOf(d)}
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  const tabList = [undefined, ...tabs]

  return (
    <div ref={pageRef} className="flex min-h-0 flex-1 flex-col">
      <header className={cn("border-b px-6 pt-5", tabs.length === 0 && "pb-4")}>
        {/* On narrow screens the buttons move below the title rather than squeezing it away. */}
        <div className="flex flex-wrap items-center gap-3">
          <BackButton to={kind.base} label={`Alle ${kind.title}`} />
          <div className="flex min-w-32 flex-1 items-center gap-2.5">
            <h1 className="min-w-0 truncate text-xl font-semibold">
              <WithIds text={title} />
            </h1>
            {number && <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{number}</span>}
            <span className="shrink-0">
              <StatusBadge status={statusOf(caseFile)} />
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Hint label="Die Beschreibung kopieren">
              <Button size="sm" onClick={() => copyDoc(main)}>
                <ClipboardCopyIcon /> Kopieren
              </Button>
            </Hint>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Weitere Aktionen">
                  <EllipsisIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem onSelect={() => setPreviewId(main.id)}>
                  <EyeIcon /> Vorschau
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => copy(titleOf(main), "Titel")}>
                  <HeadingIcon /> Seitentitel kopieren
                </DropdownMenuItem>
                {several && (
                  <DropdownMenuItem onSelect={copyAll}>
                    <CopyIcon /> Alle Dokumente kopieren
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={saveAsFolder}>
                  <FolderDownIcon /> Als Ordner speichern
                </DropdownMenuItem>
                {canRandomize(mainTemplate) && (
                  <DropdownMenuItem onSelect={() => randomize(main)}>
                    <DicesIcon /> Würfeln
                  </DropdownMenuItem>
                )}
                {mainTemplate.blank && (
                  <DropdownMenuItem onSelect={() => copyBlank(main)}>
                    <FileTextIcon /> Vorlage kopieren
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setEditingDetails(true)}>
                  <PencilIcon /> {kind.noun} bearbeiten
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => onDelete(caseFile)}>
                  <Trash2Icon /> {kind.noun} löschen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 text-xs sm:grid-cols-4">
          <Meta label="Aktenzeichen">{number || "—"}</Meta>
          <Meta label="Typ">{type?.label ?? mainTemplate.label}</Meta>
          <Meta label="Erstellt">{formatDate(caseFile.createdAt)}</Meta>
          <Meta label="Geändert">{formatRelative(caseFile.updatedAt)}</Meta>
        </dl>

        <div className="mt-5 grid justify-items-start gap-2.5">
          <h2 className="text-sm font-semibold">Ablage</h2>
          <span className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <UserIcon className="size-5" />
            </span>
            <span className="grid gap-0.5">
              <span className="font-semibold">{ablage ? ablage.name.trim() || "Unbekannt" : "—"}</span>
              {ablage?.id && <span className="text-sm text-muted-foreground">{ablage.id.trim().toUpperCase()}</span>}
            </span>
          </span>
        </div>

        {tabs.length > 0 && (
          <div role="tablist" aria-label={`Teile der ${kind.noun}`} className="-mx-3 mt-3 flex items-center gap-0.5 no-scrollbar overflow-x-auto">
            {tabList.map((s, index) => {
              const selected = s === tab
              return (
                <button
                  key={s?.title ?? "details"}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  data-tab={index}
                  onClick={() => setTab(s)}
                  onKeyDown={(e) => {
                    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
                    const targets: Partial<Record<string, number>> = {
                      ArrowLeft: index - 1,
                      ArrowRight: index + 1,
                      Home: 0,
                      End: tabList.length - 1,
                    }
                    const target = targets[e.key]
                    if (target === undefined) return
                    e.preventDefault()
                    const next = (target + tabList.length) % tabList.length
                    setTab(tabList[next])
                    e.currentTarget.parentElement?.querySelector<HTMLElement>(`[data-tab="${next}"]`)?.focus()
                  }}
                  className={cn(
                    "relative shrink-0 px-3 pt-1.5 pb-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                    selected &&
                      "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-foreground",
                  )}
                >
                  {s?.title ?? "Details"}
                </button>
              )
            })}
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <div ref={bodyRef} className="relative min-h-0 min-w-0 flex-1 overflow-y-auto px-6 py-6">
          {tab ? (
            // Keyed by tab, so switching tabs fades the new one in.
            <Panel key={tab.title} id="tab" title={tab.title} description={tab.description}>
              <SectionFields
                section={tab}
                values={main.values}
                reader={mainReader}
                onChange={(key, value) => api.setValue(caseFile.id, main.id, key, value)}
                onUpdate={(key, fn) => api.updateValue(caseFile.id, main.id, key, fn)}
                suggestions={suggestions}
                docId={main.id}
              />
            </Panel>
          ) : (
            <div className="grid gap-8">
              <MeHint me={mainReader.me} />
              <Panel
                id="beschreibung"
                title="Beschreibung"
                actions={editButton(main)}
              >
                {roomForSide && !locked(main) ? (
                  <div className="grid grid-cols-2 gap-6">
                    <div className="min-w-0">{formOf(main)}</div>
                    <div className="min-w-0 border-l pl-6">{rendered(main)}</div>
                  </div>
                ) : (
                  formOf(main)
                )}
              </Panel>
              {(reports.length > 0 || attachItems) && <hr />}
              {(reports.length > 0 || attachItems) && (
                <Panel
                  id="berichte"
                  title="Berichte"
                  actions={
                    attachItems && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <FilePlusIcon /> Bericht hinzufügen
                          </Button>
                        </DropdownMenuTrigger>
                        {/* The new Bericht's first field keeps the focus, not the button. */}
                        <DropdownMenuContent
                          align="end"
                          className="w-60"
                          onCloseAutoFocus={(e) => {
                            if (!addedFromMenu.current) return
                            addedFromMenu.current = false
                            e.preventDefault()
                          }}
                        >
                          <DropdownMenuLabel>Vorlage</DropdownMenuLabel>
                          {attachItems}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )
                  }
                >
                  {reports.length > 0 ? (
                    <div className="grid gap-2">{reports.map(report)}</div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Über „Bericht hinzufügen“ eine Vorlage wählen.</p>
                  )}
                </Panel>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!previewDoc} onOpenChange={(o) => !o && setPreviewId(undefined)}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[calc(100svh-4rem)] pb-0 sm:max-w-5xl"
          onKeyDown={(e) => {
            // Ctrl/⌘+C copies the whole document, unless some text is selected.
            // Alt+Shift+C (the title) is handled for the whole page.
            if (previewDoc && (e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "c" && !window.getSelection()?.toString()) {
              e.preventDefault()
              copyDoc(previewDoc)
            }
          }}
        >
          <DialogTitle className="sr-only">{previewDoc && nameOf(previewDoc)}</DialogTitle>
          <DialogDescription className="sr-only">So wird das Dokument eingefügt.</DialogDescription>
          {/* The text scrolls inside the panel's padding, so the rounded corners never clip the scrollbar. */}
          <div className="flex min-h-0 flex-1 rounded-xl bg-card p-1 ring-1 ring-border">
            <MarkdownText text={preview} />
          </div>
          {/* Like the command palette's footer: what is shown, and the keys that act on it. */}
          <div className="flex h-14 shrink-0 items-center gap-5 px-3.5 text-sm text-muted-foreground">
            <span className="min-w-0 flex-1 truncate">
              {previewDoc && nameOf(previewDoc)} · {preview.split("\n").length.toLocaleString("de-DE")} Zeilen Markdown
            </span>
            {/* Phones have no keys for the shortcuts, so they get a button instead. */}
            <span className="hidden sm:contents">
              <Shortcut keys={["Alt", "Umschalt", "C"]}>Titel kopieren</Shortcut>
              <Shortcut keys={["Strg", "C"]}>Kopieren</Shortcut>
            </span>
            <Button size="sm" onClick={() => previewDoc && copyDoc(previewDoc)} className="sm:hidden">
              <ClipboardCopyIcon /> Kopieren
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <EditCaseFileDialog
        caseFile={editingDetails ? caseFile : undefined}
        kind={kind}
        me={me}
        onSave={(details) => {
          api.editDetails(caseFile.id, details)
          setEditingDetails(false)
        }}
        onClose={() => setEditingDetails(false)}
      />
    </div>
  )
}

/** One part of the case file, e.g. the Beschreibung: a heading with its actions, then its content. */
function Panel({
  id,
  title,
  description,
  actions,
  children,
}: {
  id: string
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className="grid gap-4 animate-in duration-200 ease-out-quint fade-in-0 slide-in-from-bottom-1">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto grid min-w-0 gap-0.5">
          <h2 id={id} className="truncate text-lg font-semibold">
            {title}
          </h2>
          {description && <p className="truncate text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      <div>{children}</div>
    </section>
  )
}

/** One detail of the case file in the header, e.g. its Aktenzeichen. */
function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <dt className="shrink-0 text-muted-foreground">{label}:</dt>
      <dd className="min-w-0 font-medium break-words">{children}</dd>
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
