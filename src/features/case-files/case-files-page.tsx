import { useCallback, useMemo, useState } from "react"
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router"
import {
  ChevronDownIcon,
  CircleCheckIcon,
  EllipsisIcon,
  EyeIcon,
  FileTextIcon,
  FolderInputIcon,
  FolderOpenIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { Explorer } from "@/components/explorer"
import { InlineEdit } from "@/components/inline-edit"
import { NoResults } from "@/components/no-results"
import { SearchField } from "@/components/search-field"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRegisterCommands, type CommandGroupDef } from "@/hooks/use-command-palette"
import { readFolder } from "@/lib/folder"
import { formatDateAndTime } from "@/lib/format-date"
import { removedToast } from "@/lib/undo"
import { CaseFileView, StatusBadge } from "./case-file-view"
import { useDnaEntries } from "@/features/dna-db/use-dna-entries"
import { ablageLabel, aktenzeichen, CASE_TYPES, caseTypeOf } from "./case-types"
import { casePath, type CaseFileKind } from "./kind"
import { NewCaseFileDialog, type NewCaseFile } from "./new-case-file-dialog"
import { POLICE_FILES_KIND } from "./police-files"
import type { CaseFile } from "./types"
import { caseFileText, caseFileTitle, useCaseFiles, useOwnName, type CaseFilesApi } from "./use-case-files"
import { IdTag, WithIds } from "./with-ids"

/** Case files filled in from the department's templates and copied out as markdown. */
export function CaseFilesPage({ kind = POLICE_FILES_KIND }: { kind?: CaseFileKind }) {
  const api = useCaseFiles(kind)
  const { createCaseFile, deleteCaseFile, restoreCaseFile } = api
  const me = useOwnName()
  const navigate = useNavigate()
  /** The type the "Neue Akte" dialog starts with; closed while undefined. */
  const [creating, setCreating] = useState<string>()

  const create = useCallback(
    ({ template, details, values }: NewCaseFile) => {
      setCreating(undefined)
      navigate(casePath(kind, createCaseFile(template, values, details)))
    },
    [createCaseFile, kind, navigate],
  )

  /** A folder of Markdown files as a new Eigene Akte, each file an Eigener Eintrag named like it. */
  const importFolder = async () => {
    const folder = await readFolder()
    if (!folder) return
    if (!folder.files.length) return void toast.error(`Keine .md-Dateien in „${folder.name}“`)
    const id = createCaseFile("eigene", undefined, { type: "eigene", title: folder.name })
    for (const file of folder.files) {
      const docId = api.addDoc(id, "eintrag")
      // "02 Notiz.md", as "Als Ordner speichern" numbers them, is titled "Notiz".
      api.setValues(id, docId, { titel: file.name.replace(/\.md$/i, "").replace(/^\d+\s+/, ""), text: file.text })
    }
    navigate(casePath(kind, id))
    toast.success(`„${folder.name}“ mit ${folder.files.length === 1 ? "1 Eintrag" : `${folder.files.length} Einträgen`} importiert`)
  }

  const onDelete = useCallback(
    (caseFile: CaseFile<string>) => {
      deleteCaseFile(caseFile.id)
      removedToast(`„${caseFileTitle(caseFile, me, kind.templates)}“`, () => restoreCaseFile(caseFile))
    },
    [deleteCaseFile, restoreCaseFile, kind, me],
  )

  // One line per case file: typing changes the case files on every key, but this only when a title changes,
  // so the palette doesn't register its commands again each time.
  const listed = api.caseFiles
    .map((a) => [a.id, caseFileTitle(a, me, kind.templates), aktenzeichen(a)].join("\t"))
    .join("\n")
  const commandGroups = useMemo<CommandGroupDef[]>(
    () => [
      {
        heading: kind.title,
        items: CASE_TYPES.map((t) => ({
          id: `${kind.id}:new:${t.id}`,
          label: `Neue ${t.label}`,
          icon: PlusIcon,
          onSelect: () => setCreating(t.id),
        })),
      },
      {
        heading: `Alle ${kind.title}`,
        actionLabel: `${kind.noun} öffnen`,
        items: (listed ? listed.split("\n") : []).map((line) => {
          const [id, label, number] = line.split("\t")
          return {
            id: `${kind.id}:${id}`,
            label,
            keywords: number ? [number] : [],
            icon: FileTextIcon,
            onSelect: () => navigate(casePath(kind, id)),
          }
        }),
      },
    ],
    [listed, kind, navigate],
  )
  useRegisterCommands(kind.id, commandGroups)

  const onNew = () => setCreating(CASE_TYPES[0].id)

  return (
    <>
      <Routes>
        <Route index element={<CaseFileList kind={kind} api={api} me={me} onNew={onNew} onImport={importFolder} onDelete={onDelete} />} />
        <Route path=":akteId" element={<CaseFileRoute kind={kind} api={api} onDelete={onDelete} />} />
      </Routes>
      <NewCaseFileDialog
        type={creating}
        kind={kind}
        caseFiles={api.caseFiles}
        onCreate={create}
        onClose={() => setCreating(undefined)}
      />
    </>
  )
}

function CaseFileRoute({
  kind,
  api,
  onDelete,
}: {
  kind: CaseFileKind
  api: CaseFilesApi
  onDelete: (caseFile: CaseFile<string>) => void
}) {
  const { akteId: caseFileId } = useParams()
  const caseFile = api.caseFiles.find((a) => a.id === caseFileId)
  if (!caseFile) return <Navigate to=".." replace />
  return <CaseFileView key={caseFile.id} kind={kind} caseFile={caseFile} api={api} onDelete={onDelete} />
}

/** Room right of a column, so the columns stand apart. */
const GAP = "pr-20"

/** What can be done with a case file of the list; shown in its context menu and its ⋯ menu. */
interface ItemAction {
  label: string
  icon: LucideIcon
  onSelect: () => void
  destructive?: boolean
}

function CaseFileList({
  kind,
  api,
  me,
  onNew,
  onImport,
  onDelete,
}: {
  kind: CaseFileKind
  api: CaseFilesApi
  me: string
  onNew: () => void
  onImport: () => void
  onDelete: (caseFile: CaseFile<string>) => void
}) {
  const [query, setQuery] = useState("")
  const [renamingId, setRenamingId] = useState<string>()
  const navigate = useNavigate()
  const { entries } = useDnaEntries()

  // Searched in the title, the Aktenzeichen, the type, the Ablage and everything entered.
  const texts = useMemo(() => new Map(api.caseFiles.map((a) => [a.id, caseFileText(a).toLowerCase()])), [api.caseFiles])
  const q = query.trim().toLowerCase()
  const shown = q
    ? api.caseFiles.filter(
        (a) =>
          [caseFileTitle(a, me, kind.templates), aktenzeichen(a), caseTypeOf(a)?.label ?? "", ablageLabel(a, entries)].some((s) =>
            s.toLowerCase().includes(q),
          ) || texts.get(a.id)?.includes(q),
      )
    : api.caseFiles

  const actions = (a: CaseFile<string>): ItemAction[] => [
    { label: "Vorschau", icon: EyeIcon, onSelect: () => navigate(casePath(kind, a.id), { state: { preview: true } }) },
    { label: "Umbenennen", icon: PencilIcon, onSelect: () => setRenamingId(a.id) },
    {
      label: a.settled ? "Als offen markieren" : "Als erledigt markieren",
      icon: CircleCheckIcon,
      onSelect: () => api.setSettled(a.id, !a.settled),
    },
    { label: "Löschen", icon: Trash2Icon, onSelect: () => onDelete(a), destructive: true },
  ]

  const row = (a: CaseFile<string>) => {
    const title = caseFileTitle(a, me, kind.templates)
    const number = aktenzeichen(a)
    return (
      <ContextMenu key={a.id}>
        <ContextMenuTrigger asChild>
          {/* The name's link covers the whole row, so any cell opens the case file. */}
          <TableRow className="group/item relative">
            <TableCell className={GAP}>{number ? <IdTag id={number} /> : <span className="text-muted-foreground">—</span>}</TableCell>
            <TableCell className={cn(GAP, "tabular-nums")}>{formatDateAndTime(a.createdAt)}</TableCell>
            <TableCell className={GAP}>
              <StatusBadge settled={a.settled} />
            </TableCell>
            <TableCell className={GAP}>
              {a.ablage ? <WithIds text={ablageLabel(a, entries)} /> : <span className="text-muted-foreground">—</span>}
            </TableCell>
            <TableCell className="w-full max-w-0 truncate font-medium">
              {renamingId === a.id ? (
                // Clearing the title goes back to the automatic one.
                <InlineEdit
                  value={title}
                  allowEmpty
                  onDone={(t) => {
                    if (t !== undefined) api.rename(a.id, t)
                    setRenamingId(undefined)
                  }}
                  placeholder={caseFileTitle({ ...a, title: "" }, me, kind.templates)}
                  aria-label={`Titel der ${kind.noun}`}
                />
              ) : (
                <Link
                  to={casePath(kind, a.id)}
                  onKeyDown={(e) => {
                    if (e.key === "F2") {
                      e.preventDefault()
                      setRenamingId(a.id)
                    }
                  }}
                  className="outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
                >
                  <WithIds text={title} />
                </Link>
              )}
            </TableCell>
            <TableCell className="relative w-0 py-0 pr-2">
              {/* The same actions without a right click; shown on hover and focus. */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Aktionen für „${title}“`}
                    className="text-muted-foreground opacity-0 group-focus-within/item:opacity-100 group-hover/item:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                  >
                    <EllipsisIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
                  {actions(a).map((x) => (
                    <DropdownMenuItem key={x.label} variant={x.destructive ? "destructive" : undefined} onSelect={x.onSelect}>
                      <x.icon /> {x.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        </ContextMenuTrigger>
        {/* Not refocusing the row keeps the focus in the title field after "Umbenennen". */}
        <ContextMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
          {actions(a).map((x) => (
            <ContextMenuItem key={x.label} variant={x.destructive ? "destructive" : undefined} onSelect={x.onSelect}>
              <x.icon /> {x.label}
            </ContextMenuItem>
          ))}
        </ContextMenuContent>
      </ContextMenu>
    )
  }

  return (
    <Explorer
      title={kind.title}
      toolbar={
        <>
          <SearchField value={query} onChange={setQuery} focusKey aria-label={`${kind.title} durchsuchen`} />
          <ButtonGroup>
            {/* Its transparent right border would show the page between the two blue halves. */}
            <Button onClick={onNew} className="border-r-0">
              <PlusIcon /> Neue {kind.noun}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                {/* The divider is drawn inside the blue, so it is exactly as tall as the buttons' fill. */}
                <Button
                  size="icon"
                  aria-label={`Weitere Wege, eine ${kind.noun} anzulegen`}
                  className="relative before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-primary-foreground/25"
                >
                  <ChevronDownIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-auto">
                <DropdownMenuItem onSelect={onImport}>
                  <FolderInputIcon /> Aus Ordner importieren
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
        </>
      }
    >
      {api.caseFiles.length === 0 ? (
        <Home kind={kind} onNew={onNew} />
      ) : (
        shown.length > 0 && (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className={GAP}>Aktenzeichen</TableHead>
                  <TableHead className={GAP}>Datum</TableHead>
                  <TableHead className={GAP}>Status</TableHead>
                  <TableHead className={GAP}>Ablage</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-0">
                    <span className="sr-only">Aktionen</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{shown.map(row)}</TableBody>
            </Table>
          </div>
        )
      )}
      {q && shown.length === 0 && api.caseFiles.length > 0 && <NoResults query={query} onReset={() => setQuery("")} />}
    </Explorer>
  )
}

/** Shown while nothing was created yet. */
function Home({ kind, onNew }: { kind: CaseFileKind; onNew: () => void }) {
  return (
    <Empty className="p-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderOpenIcon />
        </EmptyMedia>
        <EmptyTitle>{kind.empty.title}</EmptyTitle>
        <EmptyDescription>{kind.empty.description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onNew}>
          <PlusIcon /> Neue {kind.noun}
        </Button>
      </EmptyContent>
    </Empty>
  )
}
