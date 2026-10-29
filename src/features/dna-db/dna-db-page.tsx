import { useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react"
import { DnaIcon, FileTextIcon, FolderIcon, PlusIcon, UserIcon } from "lucide-react"
import { Link, Route, Routes, useNavigate, useSearchParams } from "react-router"
import { cn } from "cn"
import { DataPagination } from "@/components/data-pagination"
import { Hint } from "@/components/hint"
import { InlineEdit } from "@/components/inline-edit"
import { NoResults } from "@/components/no-results"
import { SearchField } from "@/components/search-field"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { caseFilePath } from "@/features/case-files/paths"
import {
  useRegisterCommands,
  type CommandGroupDef,
} from "@/hooks/use-command-palette"
import { pageCount } from "@/lib/pagination"
import { textKey } from "@/lib/text"
import { removedToast } from "@/lib/undo"
import { mentionsOf, useCaseFileMentions, type CaseFileMention } from "./case-file-mentions"
import { DnaCaseNumbersDialog } from "./dna-case-numbers-dialog"
import { DnaEntryDialog } from "./dna-entry-dialog"
import { DnaEntryContextMenu } from "./dna-entry-menu"
import { DnaTagsDialog } from "./dna-tags-dialog"
import { IdChip } from "./id-chip"
import { personPath } from "./paths"
import { PersonRoute } from "./person-view"
import { TagBadge } from "./tag-badge"
import { collectTags } from "./tags"
import type { DnaEntry } from "./types"
import { entryName, useDnaEntries } from "./use-dna-entries"

const PAGE_SIZE = 25

export function DnaDbPage() {
  return (
    <Routes>
      <Route index element={<EntryList />} />
      <Route path="person/:entryId" element={<PersonRoute />} />
    </Routes>
  )
}

function EntryList() {
  const { entries, addEntry, updateEntry, deleteEntry } = useDnaEntries()
  // In the URL, so reloading or going back keeps the search.
  const [params, setParams] = useSearchParams()
  const query = params.get("q") ?? ""
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<DnaEntry | undefined>()
  const [editingTags, setEditingTags] = useState<DnaEntry | undefined>()
  // By id, so the dialog shows the stored entry with the changes it saved.
  const [editingCasesId, setEditingCasesId] = useState<string>()
  const [renamingId, setRenamingId] = useState<string>()
  const bodyRef = useRef<HTMLTableSectionElement>(null)
  // When (event time) the context menu was last opened from the keyboard; the browser's own event follows.
  const keyboardMenuAt = useRef(0)
  const navigate = useNavigate()

  const knownTags = useMemo(() => collectTags(entries), [entries])
  const mentions = useCaseFileMentions(entries)

  const filtered = useMemo(() => {
    // Every word on its own, so "Mustermann Max" finds "Max Mustermann".
    const words = textKey(query).split(/\s+/).filter(Boolean)
    const sorted = sortByName(entries)
    if (!words.length) return sorted
    return sorted.filter((e) => {
      const fields = [e.name, e.dnaId, e.fingerprintId, ...(e.tags ?? []).map((t) => t.name), ...(e.caseNumbers ?? [])].map(textKey)
      return words.every((w) => fields.some((v) => v.includes(w)))
    })
  }, [entries, query])

  const [page, setPage] = useState(1)
  // Clamp so deleting/filtering never leaves us on a page that no longer exists.
  const currentPage = Math.min(page, pageCount(filtered.length, PAGE_SIZE))
  const paged = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  function setQuery(q: string) {
    // Replaced, not pushed: going back leaves the page instead of undoing keystrokes.
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (q) next.set("q", q)
        else next.delete("q")
        return next
      },
      { replace: true },
    )
    setPage(1)
  }

  function rows() {
    return [...(bodyRef.current?.querySelectorAll<HTMLElement>("[data-entry-id]") ?? [])]
  }

  /**
   * Focuses the row of the entry once it's rendered, e.g. after a dialog closed. With `ifLost`
   * only while nothing else has the focus, e.g. after a click elsewhere ended a rename.
   */
  function focusRow(id: string | undefined, ifLost = false) {
    if (!id) return
    requestAnimationFrame(() => {
      if (ifLost && document.activeElement && document.activeElement !== document.body) return
      rows().find((r) => r.dataset.entryId === id)?.focus()
    })
  }

  function openCreate() {
    setEditing(undefined)
    setDialogOpen(true)
  }

  function openEdit(entry: DnaEntry) {
    setEditing(entry)
    setDialogOpen(true)
  }

  function remove(entry: DnaEntry) {
    // The focus moves on to the next row, or the one before for the last.
    const i = paged.findIndex((e) => e.id === entry.id)
    const next = paged[i + 1] ?? paged[i - 1]
    const undo = deleteEntry(entry.id)
    removedToast(`Eintrag „${entryName(entry)}“`, () => {
      undo()
      focusRow(entry.id)
    })
    focusRow(next?.id)
  }

  function rename(entry: DnaEntry, name: string | undefined) {
    setRenamingId(undefined)
    if (name !== undefined) updateEntry(entry.id, { name })
    focusRow(entry.id, true)
  }

  /** Opens the row's context menu below its first cell, as if it was right-clicked there. */
  function openMenu(row: HTMLElement, at: number) {
    keyboardMenuAt.current = at
    const rect = row.getBoundingClientRect()
    row.dispatchEvent(
      new window.MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + 16,
        clientY: rect.bottom,
      }),
    )
  }

  function handleRowKeyDown(e: KeyboardEvent<HTMLElement>, entry: DnaEntry) {
    // Keys on the buttons in a row are theirs.
    if (e.target !== e.currentTarget) return
    const all = rows()
    const index = all.indexOf(e.currentTarget)
    const moveTo = (i: number) => {
      e.preventDefault()
      all[Math.max(0, Math.min(i, all.length - 1))]?.focus()
    }
    if (e.key === "ArrowDown") moveTo(index + 1)
    else if (e.key === "ArrowUp") moveTo(index - 1)
    else if (e.key === "Home") moveTo(0)
    else if (e.key === "End") moveTo(all.length - 1)
    else if (e.key === "Enter") {
      e.preventDefault()
      openEdit(entry)
    } else if (e.key === "F2") {
      e.preventDefault()
      setRenamingId(entry.id)
    } else if (e.key === "Delete") {
      e.preventDefault()
      remove(entry)
    } else if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
      e.preventDefault()
      openMenu(e.currentTarget, e.timeStamp)
    }
  }

  function handleRowContextMenu(e: MouseEvent) {
    // The browser's own event after the keyboard opened the menu would move it to the corner.
    if (e.nativeEvent.isTrusted && e.timeStamp - keyboardMenuAt.current < 1000) e.preventDefault()
  }

  const commandGroups = useMemo<CommandGroupDef[]>(
    () => [
      {
        heading: "DNA-DB",
        items: [
          {
            id: "dna-db:new",
            label: "Eintrag hinzufügen",
            icon: PlusIcon,
            onSelect: () => {
              setEditing(undefined)
              setDialogOpen(true)
            },
          },
        ],
      },
      {
        heading: "Einträge",
        actionLabel: "Eintrag öffnen",
        items: sortByName(entries).map((entry) => ({
          id: `dna-db:entry:${entry.id}`,
          label: entryName(entry),
          keywords: [
            entry.dnaId,
            entry.fingerprintId,
            ...(entry.tags ?? []).map((t) => t.name),
          ],
          icon: UserIcon,
          hint: entry.dnaId,
          onSelect: () => {
            setEditing(entry)
            setDialogOpen(true)
          },
        })),
      },
    ],
    [entries],
  )
  useRegisterCommands("dna-db", commandGroups)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      {entries.length > 0 && (
        <div className="flex shrink-0 items-center gap-2">
          <SearchField
            value={query}
            onChange={setQuery}
            focusKey
            aria-label="Name, DNA-ID, Fingerabdruck-ID, Tag oder Aktennummer suchen"
          />
          <Button onClick={openCreate}>
            <PlusIcon /> Neuer Eintrag
          </Button>
        </div>
      )}

      {/* overflow-hidden clips row hover backgrounds to the rounded corners. */}
      <div className={cn("flex min-h-0 flex-1 flex-col", entries.length > 0 && "overflow-hidden rounded-xl border bg-card")}>
        {entries.length === 0 ? (
          <NoEntries onCreate={openCreate} />
        ) : filtered.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <NoResults query={query} onReset={() => setQuery("")} />
          </div>
        ) : (
          // This div scrolls (not shadcn's table container) so the header can stick.
          // Keyed by page so each page starts scrolled to the top.
          <div
            key={currentPage}
            className="min-h-0 flex-1 overflow-auto [&_[data-slot=table-container]]:overflow-visible"
          >
            <Table className="[&_th]:text-xs [&_th]:font-medium [&_th]:tracking-wide [&_th]:text-muted-foreground [&_th]:uppercase">
              {/* Opaque bg-card underneath so the tinted header row stays solid while sticky. */}
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Name</TableHead>
                  <TableHead>DNA-ID</TableHead>
                  <TableHead>Fingerabdruck-ID</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Akten</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody ref={bodyRef} className="stagger-in">
                {paged.map((entry) => (
                  <DnaEntryContextMenu
                    key={entry.id}
                    entry={entry}
                    knownTags={knownTags}
                    mentions={mentionsOf(mentions, entry)}
                    onOpenPerson={() => navigate(personPath(entry.id))}
                    onEdit={() => openEdit(entry)}
                    onRename={() => setRenamingId(entry.id)}
                    onEditTags={() => setEditingTags(entry)}
                    onEditCaseNumbers={() => setEditingCasesId(entry.id)}
                    onSetTags={(tags) => updateEntry(entry.id, { tags })}
                    onDelete={() => remove(entry)}
                  >
                    <TableRow
                      data-entry-id={entry.id}
                      tabIndex={0}
                      aria-label={entryName(entry)}
                      onDoubleClick={() => openEdit(entry)}
                      onKeyDown={(e) => handleRowKeyDown(e, entry)}
                      onContextMenu={handleRowContextMenu}
                      className="outline-none focus-visible:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring data-[state=open]:bg-muted/50"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <UserIcon className="size-4" />
                          </span>
                          {renamingId === entry.id ? (
                            <InlineEdit
                              value={entry.name}
                              onDone={(name) => rename(entry, name)}
                              // Without a name it's an unknown trace; that needs an ID.
                              allowEmpty={!!(entry.dnaId || entry.fingerprintId)}
                              placeholder="Unbekannt"
                              aria-label="Name"
                              className="max-w-64 font-medium"
                            />
                          ) : (
                            <Hint label="Personenansicht">
                              <Link
                                to={personPath(entry.id)}
                                // Don't let a quick double-click on the name open the edit dialog.
                                onDoubleClick={(e) => e.stopPropagation()}
                                className={cn(
                                  "rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                                  entry.name.trim() ? "font-medium" : "text-muted-foreground italic",
                                )}
                              >
                                {entryName(entry)}
                              </Link>
                            </Hint>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <IdChip value={entry.dnaId} label="DNA-ID" />
                      </TableCell>
                      <TableCell>
                        <IdChip value={entry.fingerprintId} label="Fingerabdruck-ID" />
                      </TableCell>
                      <TableCell>
                        {entry.tags?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {entry.tags.map((tag) => (
                              <TagBadge key={tag.name} tag={tag} />
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">---</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <CaseCounter count={entry.caseNumbers?.length ?? 0} onClick={() => setEditingCasesId(entry.id)} />
                          <MentionsButton mentions={mentionsOf(mentions, entry)} />
                        </div>
                      </TableCell>
                    </TableRow>
                  </DnaEntryContextMenu>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {entries.length > 0 && (
        <DataPagination
          total={filtered.length}
          page={currentPage}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}

      <DnaEntryDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) focusRow(editing?.id)
        }}
        entry={editing}
        entries={entries}
        knownTags={knownTags}
        onSubmit={(input) => {
          if (!editing) addEntry({ name: "", dnaId: "", fingerprintId: "", ...input })
          else if (Object.keys(input).length) updateEntry(editing.id, input)
        }}
      />

      <DnaTagsDialog
        entry={editingTags}
        knownTags={knownTags}
        onOpenChange={(open) => {
          if (open) return
          focusRow(editingTags?.id)
          setEditingTags(undefined)
        }}
        onSubmit={(tags) => editingTags && updateEntry(editingTags.id, { tags })}
      />

      <DnaCaseNumbersDialog
        entry={entries.find((e) => e.id === editingCasesId)}
        onOpenChange={(open) => {
          if (open) return
          focusRow(editingCasesId)
          setEditingCasesId(undefined)
        }}
        onChange={(id, update) => updateEntry(id, (e) => ({ caseNumbers: update(e.caseNumbers ?? []) }))}
      />
    </div>
  )
}

function NoEntries({ onCreate }: { onCreate: () => void }) {
  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <DnaIcon />
        </EmptyMedia>
        <EmptyTitle>Noch keine Einträge</EmptyTitle>
        <EmptyDescription>
          Lege den ersten Eintrag an, um die DNA-Datenbank zu füllen.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onCreate}>
          <PlusIcon /> Neuer Eintrag
        </Button>
      </EmptyContent>
    </Empty>
  )
}

function sortByName(entries: DnaEntry[]) {
  // Unknown ones (without a name) go last.
  return [...entries].sort((a, b) => Number(!a.name.trim()) - Number(!b.name.trim()) || a.name.localeCompare(b.name))
}

/** How many case numbers the entry has ("3 Akten"); opens the dialog that manages them. */
function CaseCounter({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <Hint label="Aktennummern verwalten">
      <button
        type="button"
        onClick={onClick}
        // Don't let a quick double-click on the counter open the edit dialog.
        onDoubleClick={(e) => e.stopPropagation()}
        aria-label={`Aktennummern verwalten (${count})`}
        className={
          count
            ? "inline-flex cursor-pointer items-center gap-1.5 rounded-md border bg-muted/60 px-2 py-0.5 text-xs transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            : "inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        }
      >
        <FolderIcon className="size-3.5" />
        {count} {count === 1 ? "Akte" : "Akten"}
      </button>
    </Hint>
  )
}

/** How many Akten mention the entry, with links to them; nothing while none does. */
function MentionsButton({ mentions }: { mentions: CaseFileMention[] }) {
  if (!mentions.length) return null
  const label = `Erwähnt in ${mentions.length} ${mentions.length === 1 ? "Akte" : "Akten"}`
  return (
    <DropdownMenu>
      <Hint label={label}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            // Don't let a quick double-click on the button open the edit dialog.
            onDoubleClick={(e) => e.stopPropagation()}
            aria-label={label}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-300 transition-colors hover:bg-sky-500/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <FileTextIcon className="size-3.5" />
            {mentions.length}
          </button>
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent align="start" className="max-h-80 w-64 overflow-y-auto">
        <DropdownMenuLabel>Erwähnt in</DropdownMenuLabel>
        {mentions.map((m) => (
          <DropdownMenuItem key={m.id} asChild>
            <Link to={caseFilePath(m.id)}>
              <FileTextIcon /> <span className="truncate">{m.title}</span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
