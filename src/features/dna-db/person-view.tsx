import { useMemo, useState, type ReactNode } from "react"
import {
  ChevronLeftIcon,
  ClipboardCopyIcon,
  FileTextIcon,
  FolderIcon,
  MessageSquareQuoteIcon,
  PencilIcon,
  ScaleIcon,
  TriangleAlertIcon,
  UserIcon,
} from "lucide-react"
import { Link, Navigate, useParams } from "react-router"
import { Hint } from "@/components/hint"
import { EmptyList } from "@/components/no-results"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { caseFilePath } from "@/features/case-files/paths"
import { useTabTitle } from "@/hooks/use-tabs"
import { copy } from "@/lib/clipboard"
import { formatDate } from "@/lib/format-date"
import { DnaEntryDialog } from "./dna-entry-dialog"
import { IdChip } from "./id-chip"
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
import type { DnaEntry } from "./types"
import { entryName, useDnaEntries } from "./use-dna-entries"

/** `/dna-db/person/:entryId`; back to the list for an entry that doesn't exist (anymore). */
export function PersonRoute() {
  const { entryId } = useParams()
  const { entries, updateEntry } = useDnaEntries()
  const entry = entries.find((e) => e.id === entryId)
  if (!entry) return <Navigate to=".." replace />
  return <PersonView entry={entry} entries={entries} onUpdate={(input) => updateEntry(entry.id, input)} />
}

/** One person: their entry and everything the Akten record about them. */
function PersonView({
  entry,
  entries,
  onUpdate,
}: {
  entry: DnaEntry
  entries: DnaEntry[]
  onUpdate: Parameters<typeof DnaEntryDialog>[0]["onSubmit"]
}) {
  const [editing, setEditing] = useState(false)
  const knownTags = useMemo(() => collectTags(entries), [entries])
  const records = usePersonRecords(entry)
  const { mentions, charges, statements } = records
  const name = entryName(entry)
  useTabTitle(name)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <Hint label="Zur DNA-DB">
            <Button variant="ghost" size="icon-sm" asChild>
              <Link to={DNA_DB_BASE} aria-label="Zur DNA-DB">
                <ChevronLeftIcon />
              </Link>
            </Button>
          </Hint>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <UserIcon className="size-5" />
          </span>
          <div className="grid min-w-0 flex-1 gap-0.5">
            <p className="truncate text-xs text-muted-foreground">
              Personenansicht · {mentions.length} {mentions.length === 1 ? "Akte" : "Akten"}
            </p>
            <h1 className={entry.name.trim() ? "truncate text-xl font-semibold" : "truncate text-xl font-semibold text-muted-foreground italic"}>
              {name}
            </h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <PencilIcon /> <span className="hidden sm:inline">Bearbeiten</span>
          </Button>
          <Hint label="Eintrag, Akten, Straftaten und Aussagen als Markdown kopieren">
            <Button size="sm" onClick={() => copy(personSummary(entry, records), "Zusammenfassung")}>
              <ClipboardCopyIcon /> <span className="hidden sm:inline">Zusammenfassung kopieren</span>
            </Button>
          </Hint>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto grid max-w-5xl gap-4">
          <Card title="Eintrag" icon={UserIcon}>
            <dl className="grid gap-x-6 gap-y-3 px-4 pb-4 text-sm sm:grid-cols-[max-content_1fr]">
              <Fact label="DNA-ID">
                <IdChip value={entry.dnaId} label="DNA-ID" />
              </Fact>
              <Fact label="Fingerabdruck-ID">
                <IdChip value={entry.fingerprintId} label="Fingerabdruck-ID" />
              </Fact>
              <Fact label="Tags">
                {entry.tags?.length ? (
                  <div className="flex flex-wrap gap-1">
                    {entry.tags.map((tag) => (
                      <TagBadge key={tag.name} tag={tag} />
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">---</span>
                )}
              </Fact>
              <Fact label="Aktennummern">
                {entry.caseNumbers?.length ? (
                  <div className="flex flex-wrap gap-1">
                    {entry.caseNumbers.map((n) => (
                      <span key={n} className="inline-flex items-center gap-1.5 rounded-md border bg-muted/60 px-2 py-0.5 text-xs">
                        <FolderIcon className="size-3.5" /> {n}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">---</span>
                )}
              </Fact>
            </dl>
          </Card>

          <Card title="Erwähnt in Akten" icon={FileTextIcon} count={mentions.length}>
            {mentions.length ? (
              <ul className="grid gap-px px-2 pb-2">
                {mentions.map((m) => (
                  <li key={m.id}>
                    <Link
                      to={caseFilePath(m.id)}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{m.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyList>Keine Akte nennt die DNA-ID, Fingerabdruck-ID oder den Namen.</EmptyList>
            )}
          </Card>

          <Card title="Straftaten" icon={ScaleIcon} count={charges.length}>
            {charges.length ? <ChargesTable charges={charges} /> : <EmptyList>Keine Straftaten in den Akten erfasst.</EmptyList>}
          </Card>

          <Card title="Aussagen" icon={MessageSquareQuoteIcon} count={statements.length}>
            {statements.length ? (
              <ul className="grid gap-2 px-4 pb-4">
                {statements.map((s) => (
                  <StatementItem key={`${s.path}:${s.role}`} statement={s} />
                ))}
              </ul>
            ) : (
              <EmptyList>Keine Aussagen von oder über diese Person.</EmptyList>
            )}
          </Card>
        </div>
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

function Card({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string
  icon: typeof UserIcon
  count?: number
  children: ReactNode
}) {
  return (
    // overflow-hidden clips row hover backgrounds to the rounded corners.
    <section className="overflow-hidden rounded-xl border bg-card">
      <h2 className="flex items-center gap-2 px-4 pt-3.5 pb-2.5 text-sm font-medium">
        <Icon className="size-4 text-muted-foreground" /> {title}
        {count !== undefined && <span className="text-muted-foreground">{count}</span>}
      </h2>
      {children}
    </section>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground sm:pt-0.5">{label}</dt>
      <dd>{children}</dd>
    </>
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
    <>
      <Table className="[&_th]:text-xs [&_th]:font-medium [&_th]:tracking-wide [&_th]:text-muted-foreground [&_th]:uppercase">
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
    </>
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
