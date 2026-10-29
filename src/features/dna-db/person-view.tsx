import { useMemo, useState, type ReactNode } from "react"
import { ClipboardCopyIcon, EllipsisIcon, FilePlus2Icon, PencilIcon, PlusIcon, TriangleAlertIcon, UserIcon } from "lucide-react"
import { Link, Navigate, useParams, useSearchParams } from "react-router"
import { BackButton } from "@/components/explorer"
import { Hint } from "@/components/hint"
import { EmptyList } from "@/components/no-results"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { caseFilePath } from "@/features/case-files/paths"
import { useTabTitle } from "@/hooks/use-tabs"
import { copy } from "@/lib/clipboard"
import { formatDate } from "@/lib/format-date"
import { useCaseFileSummaries, type CaseFileMention, type CaseFileSummary } from "./case-file-mentions"
import { DnaEntryDialog } from "./dna-entry-dialog"
import { IdChip } from "./id-chip"
import { TodoPanel } from "@/features/todos/todo-panel"
import { useTodos } from "@/features/todos/use-todos"
import { NoteList } from "@/features/notes/note-list"
import { DNA_DB_BASE } from "./paths"
import {
  chargePenalty,
  chargesTotal,
  chargeTitle,
  personSummary,
  statementRole,
  usePersonRecords,
  type PersonCharge,
  type PersonStatement,
  type RecordSource,
} from "./person-records"
import { TagBadge } from "./tag-badge"
import { collectTags } from "./tags"
import type { DnaEntry, DnaEntryInput, ProfileKey } from "./types"
import { entryName, useDnaEntries } from "./use-dna-entries"

const TABS = ["akten", "straftaten", "aussagen", "todos", "notizen"] as const
type Tab = (typeof TABS)[number]
const isTab = (value: string | null): value is Tab => TABS.includes(value as Tab)

/** `/dna-db/person/:entryId`; back to the list for an entry that doesn't exist (anymore). */
export function PersonRoute() {
  const { entryId } = useParams()
  const { entries, updateEntry } = useDnaEntries()
  const entry = entries.find((e) => e.id === entryId)
  if (!entry) return <Navigate to=".." replace />
  return <PersonView entry={entry} entries={entries} onUpdate={(input) => updateEntry(entry.id, input)} />
}

/** One person: their details, and tabs with the Akten, what they record, todos and notes. */
function PersonView({
  entry,
  entries,
  onUpdate,
}: {
  entry: DnaEntry
  entries: DnaEntry[]
  onUpdate: (input: Partial<DnaEntryInput> | ((entry: DnaEntry) => Partial<DnaEntryInput>)) => void
}) {
  const [editing, setEditing] = useState(false)
  const [creatingNote, setCreatingNote] = useState(false)
  // In the URL, so coming back from an Akte opens the same tab.
  const [params, setParams] = useSearchParams()
  const tab = isTab(params.get("tab")) ? (params.get("tab") as Tab) : "akten"
  const knownTags = useMemo(() => collectTags(entries), [entries])
  const caseFiles = useCaseFileSummaries()
  const records = usePersonRecords(entry)
  const { mentions, charges, statements } = records
  const todosApi = useTodos()
  const todos = useMemo(
    () => todosApi.todos.filter((t) => t.personIds?.includes(entry.id)),
    [todosApi.todos, entry.id],
  )
  const name = entryName(entry)
  useTabTitle(name)

  const profile = (key: ProfileKey) => entry[key]?.trim() || undefined

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="grid gap-3 border-b bg-card px-6 py-4">
        <div className="flex items-center gap-3">
          <BackButton to={DNA_DB_BASE} label="Zur DNA-DB" />
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <UserIcon className="size-4" />
          </span>
          <h1
            className={
              entry.name.trim()
                ? "min-w-0 flex-1 truncate text-xl font-semibold"
                : "min-w-0 flex-1 truncate text-xl font-semibold text-muted-foreground italic"
            }
          >
            {name}
          </h1>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} aria-label="Bearbeiten">
            <PencilIcon /> <span className="hidden sm:inline">Bearbeiten</span>
          </Button>
          <DropdownMenu>
            <Hint label="Weitere Aktionen">
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label="Weitere Aktionen">
                  <EllipsisIcon />
                </Button>
              </DropdownMenuTrigger>
            </Hint>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem onSelect={() => copy(personSummary(entry, records), "Zusammenfassung")}>
                <ClipboardCopyIcon /> Zusammenfassung kopieren
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Alias">{profile("alias")}</Fact>
          <Fact label="Geschlecht">{profile("gender")}</Fact>
          <Fact label="Geburtsdatum">{profile("birthDate")}</Fact>
          <Fact label="Telefonnummer">{profile("phone") && <Copyable value={profile("phone")!} label="Telefonnummer" />}</Fact>
          <Fact label="E-Mail">{profile("email") && <Copyable value={profile("email")!} label="E-Mail" />}</Fact>
          <Fact label="Whistle">{profile("whistle")}</Fact>
          <Fact label="Adresse">{profile("address")}</Fact>
          <Fact label="Aktennummern">{entry.caseNumbers?.length ? entry.caseNumbers.join(", ") : undefined}</Fact>
          <Fact label="Fingerabdruck-ID">
            {entry.fingerprintId && <IdChip value={entry.fingerprintId} label="Fingerabdruck-ID" />}
          </Fact>
          <Fact label="DNA-ID">{entry.dnaId && <IdChip value={entry.dnaId} label="DNA-ID" />}</Fact>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 lg:col-span-2">
            <dt className="text-muted-foreground">Tags:</dt>
            <dd className="flex flex-wrap items-center gap-1">
              {entry.tags?.length ? (
                entry.tags.map((tag) => <TagBadge key={tag.name} tag={tag} />)
              ) : (
                <span className="text-muted-foreground italic">Keine</span>
              )}
              <Hint label="Tags bearbeiten">
                <Button variant="outline" size="icon-xs" aria-label="Tags bearbeiten" onClick={() => setEditing(true)}>
                  <PlusIcon />
                </Button>
              </Hint>
            </dd>
          </div>
        </dl>
      </header>

      <main className="px-6 py-6">
        <Tabs
          value={tab}
          onValueChange={(value) =>
            setParams(
              (prev) => {
                const next = new URLSearchParams(prev)
                next.set("tab", value)
                return next
              },
              { replace: true },
            )
          }
          className="gap-0 overflow-hidden rounded-xl border bg-card"
        >
          {/* The bottom line is a shadow inside the header, so the active tab's line (inside
              the scrolling list) lies right on it instead of being clipped. */}
          <div className="flex items-center gap-2 pr-3 shadow-[inset_0_-1px_0_var(--color-border)]">
            <TabsList variant="line" className="h-auto! min-w-0 flex-1 justify-start gap-0 overflow-x-auto p-0 px-3">
              <PersonTab value="akten">Akten</PersonTab>
              <PersonTab value="straftaten">Straftaten</PersonTab>
              <PersonTab value="aussagen">Aussagen</PersonTab>
              <PersonTab value="todos">Todos</PersonTab>
              <PersonTab value="notizen">Notizen</PersonTab>
            </TabsList>
            {tab === "notizen" && (
              <Button size="sm" variant="outline" onClick={() => setCreatingNote(true)}>
                <FilePlus2Icon /> Notiz hinzufügen
              </Button>
            )}
          </div>

          <TabsContent value="akten" className="p-4">
            {mentions.length ? (
              <CaseFilesTable mentions={mentions} caseFiles={caseFiles} />
            ) : (
              <EmptyList>Keine Akte nennt die DNA-ID, Fingerabdruck-ID oder den Namen.</EmptyList>
            )}
          </TabsContent>
          <TabsContent value="straftaten" className="p-4">
            {charges.length ? (
              <ChargesTable charges={charges} />
            ) : (
              <EmptyList>Keine Straftaten in den Akten erfasst.</EmptyList>
            )}
          </TabsContent>
          <TabsContent value="aussagen" className="p-4">
            {statements.length ? (
              <ul className="grid gap-2">
                {statements.map((s) => (
                  <StatementItem key={`${s.path}:${s.role}`} statement={s} />
                ))}
              </ul>
            ) : (
              <EmptyList>Keine Aussagen von oder über diese Person.</EmptyList>
            )}
          </TabsContent>
          <TabsContent value="todos" className="p-4">
            <TodoPanel
              todos={todos}
              api={todosApi}
              preset={{ personIds: [entry.id] }}
              empty="Noch keine Todos für diese Person."
            />
          </TabsContent>
          {/* On the page's background, so the notes look as they do under "Notizen". */}
          <TabsContent value="notizen" className="bg-background p-4">
            <NoteList
              notes={entry.notes ?? []}
              onUpdate={(change) => onUpdate((e) => ({ notes: change(e.notes ?? []) }))}
              creating={creatingNote}
              onCreatingChange={setCreatingNote}
              empty={<EmptyList>Noch keine Notizen zu dieser Person.</EmptyList>}
            />
          </TabsContent>
        </Tabs>
      </main>

      <DnaEntryDialog
        open={editing}
        onOpenChange={setEditing}
        entry={entry}
        entries={entries}
        knownTags={knownTags}
        onSubmit={(input) => {
          if (Object.keys(input).length) onUpdate(input)
        }}
      />
    </div>
  )
}

function PersonTab({ value, children }: { value: Tab; children: ReactNode }) {
  return (
    <TabsTrigger
      value={value}
      className="h-12 flex-none px-3 text-[0.95rem] after:bottom-0! data-active:text-primary! group-data-[variant=line]/tabs-list:after:bg-primary"
    >
      {children}
    </TabsTrigger>
  )
}

/** "Label: value"; empty values show nothing after the label. */
function Fact({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <dt className="shrink-0 text-muted-foreground">{label}:</dt>
      <dd className="min-w-0 truncate">{children}</dd>
    </div>
  )
}

/** A detail that copies itself on click, e.g. the phone number. */
function Copyable({ value, label }: { value: string; label: string }) {
  return (
    <Hint label={`${label} kopieren`}>
      <button
        type="button"
        onClick={() => copy(value, label)}
        className="max-w-full cursor-pointer truncate rounded-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {value}
      </button>
    </Hint>
  )
}

const TABLE_HEAD = "[&_th]:text-xs [&_th]:font-medium [&_th]:tracking-wide [&_th]:text-muted-foreground [&_th]:uppercase"

function CaseFilesTable({
  mentions,
  caseFiles,
}: {
  mentions: CaseFileMention[]
  caseFiles: Map<string, CaseFileSummary>
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table className={TABLE_HEAD}>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead>Titel</TableHead>
            <TableHead>Datum</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mentions.map((m) => {
            const c = caseFiles.get(m.id)
            return (
              <TableRow key={m.id}>
                <TableCell className="max-w-0 w-full">
                  <Link
                    to={caseFilePath(m.id)}
                    className="block truncate text-sky-300 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {m.title}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">{c ? formatDate(c.createdAt) : "--"}</TableCell>
                <TableCell>
                  {c?.settled ? (
                    <span className="text-muted-foreground">Abgeschlossen</span>
                  ) : (
                    <span className="text-emerald-300">Laufend</span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

/** Date and Akte of an item, linking to its document. */
function SourceLink({ source }: { source: RecordSource }) {
  return (
    <Hint label={`${source.caseFileTitle} › ${source.docLabel}`}>
      <Link
        to={source.path}
        className="block max-w-72 truncate text-sky-300 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {source.caseFileTitle}
      </Link>
    </Hint>
  )
}

function ChargesTable({ charges }: { charges: PersonCharge[] }) {
  const total = chargesTotal(charges)
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table className={TABLE_HEAD}>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead>Datum</TableHead>
            <TableHead>Paragraph</TableHead>
            <TableHead>Tatbestand</TableHead>
            <TableHead>Strafmaß</TableHead>
            <TableHead>Akte</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {charges.map((c) => (
            <TableRow key={`${c.path}:${c.charge.row.id}`}>
              <TableCell className="text-muted-foreground tabular-nums">{formatDate(c.date)}</TableCell>
              {c.charge.offense ? (
                <>
                  <TableCell className="font-mono text-xs">{c.charge.offense.ref}</TableCell>
                  <TableCell className="whitespace-normal">{chargeTitle(c.charge)}</TableCell>
                  <TableCell className="tabular-nums">{chargePenalty(c.charge)}</TableCell>
                </>
              ) : (
                <>
                  <TableCell className="font-mono text-xs">{c.charge.row.offense || "--"}</TableCell>
                  <TableCell colSpan={2} className="text-amber-300">
                    <TriangleAlertIcon className="mr-1.5 inline size-3.5 align-[-2px]" />
                    Unbekannte Straftat (nicht im Gesetzbuch)
                  </TableCell>
                </>
              )}
              <TableCell>
                <SourceLink source={c} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {total && (
        <p className="border-t px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">Gesamt:</span> <span className="font-medium tabular-nums">{total}</span>
        </p>
      )}
    </div>
  )
}

function StatementItem({ statement: s }: { statement: PersonStatement }) {
  return (
    <li className="rounded-lg border bg-muted/20 px-3.5 py-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
        <span className="font-medium">{statementRole(s)}</span>
        <span className="text-muted-foreground">·</span>
        <span className="truncate">{s.docLabel}</span>
        <span className="ml-auto flex items-baseline gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">{formatDate(s.date)}</span>
          <SourceLink source={s} />
        </span>
      </div>
      {s.lines.length ? (
        <ul className="mt-2 grid list-disc gap-0.5 pl-5 text-sm text-muted-foreground">
          {s.lines.map((line, i) => (
            <li key={i}>{line.replace(/^[-*]\s+/, "")}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground italic">Ohne Text</p>
      )}
    </li>
  )
}
