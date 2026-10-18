import { useCallback, useMemo, useState, type ReactNode } from "react"
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router"
import {
  CircleCheckIcon,
  EllipsisIcon,
  EyeIcon,
  FileTextIcon,
  FolderOpenIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react"
import { Explorer, EXPLORER_CARD, EXPLORER_CARDS } from "@/components/explorer"
import { Hint } from "@/components/hint"
import { InlineEdit } from "@/components/inline-edit"
import { NoResults } from "@/components/no-results"
import { SearchField } from "@/components/search-field"
import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { useRegisterCommands, type CommandGroupDef } from "@/hooks/use-command-palette"
import { formatDateTime } from "@/lib/format-date"
import { removedToast } from "@/lib/undo"
import { CaseFileView } from "./case-file-view"
import { casePath, searchTemplates, standaloneTemplates, templateGroups, type CaseFileKind } from "./kind"
import { POLICE_FILES_KIND } from "./police-files"
import type { CaseFile } from "./types"
import { caseFileText, caseFileTitle, useCaseFiles, useOwnName, type CaseFilesApi } from "./use-case-files"
import { TemplateList } from "./template-list"
import { WithIds } from "./with-ids"

/** Case files filled in from the department's templates and copied out as markdown. */
export function CaseFilesPage({ kind = POLICE_FILES_KIND }: { kind?: CaseFileKind }) {
  const api = useCaseFiles(kind)
  const { createCaseFile, deleteCaseFile, restoreCaseFile } = api
  const me = useOwnName()
  const navigate = useNavigate()

  const create = useCallback(
    (template: string) => navigate(casePath(kind, createCaseFile(template))),
    [createCaseFile, kind, navigate],
  )

  const onDelete = useCallback(
    (caseFile: CaseFile<string>) => {
      deleteCaseFile(caseFile.id)
      removedToast(`„${caseFileTitle(caseFile, me, kind.templates)}"`, () => restoreCaseFile(caseFile))
    },
    [deleteCaseFile, restoreCaseFile, kind, me],
  )

  // One line per case file: typing changes the case files on every key, but this only when a title changes,
  // so the palette doesn't register its commands again each time.
  const listed = api.caseFiles
    .map((a) => [a.id, caseFileTitle(a, me, kind.templates), kind.templates[a.docs[0].template].label].join("\t"))
    .join("\n")
  const commandGroups = useMemo<CommandGroupDef[]>(
    () => [
      {
        heading: kind.title,
        items: standaloneTemplates(kind).map((t) => ({
          id: `${kind.id}:new:${t.id}`,
          label: `Neue ${t.label}`,
          icon: PlusIcon,
          onSelect: () => create(t.id),
        })),
      },
      {
        heading: `Alle ${kind.title}`,
        actionLabel: `${kind.noun} öffnen`,
        items: (listed ? listed.split("\n") : []).map((line) => {
          const [id, label, template] = line.split("\t")
          return {
            id: `${kind.id}:${id}`,
            label,
            keywords: [template],
            icon: FileTextIcon,
            onSelect: () => navigate(casePath(kind, id)),
          }
        }),
      },
    ],
    [listed, kind, navigate, create],
  )
  useRegisterCommands(kind.id, commandGroups)

  return (
    <Routes>
      <Route index element={<CaseFileList kind={kind} api={api} me={me} onCreate={create} onDelete={onDelete} />} />
      <Route
        path=":akteId"
        element={<CaseFileRoute kind={kind} api={api} me={me} onCreate={create} onDelete={onDelete} />}
      />
    </Routes>
  )
}

interface ListProps {
  kind: CaseFileKind
  api: CaseFilesApi
  me: string
  onCreate: (template: string) => void
  onDelete: (caseFile: CaseFile<string>) => void
}

function CaseFileRoute(props: ListProps) {
  const { akteId: caseFileId } = useParams()
  const caseFile = props.api.caseFiles.find((a) => a.id === caseFileId)
  if (!caseFile) return <Navigate to=".." replace />
  return <CaseFileView key={caseFile.id} kind={props.kind} caseFile={caseFile} api={props.api} onDelete={props.onDelete} />
}

function NewCaseFileMenu({
  kind,
  onCreate,
  hint,
  children,
}: {
  kind: CaseFileKind
  onCreate: (template: string) => void
  /** Tooltip of the trigger. */
  hint?: string
  children: ReactNode
}) {
  return (
    <DropdownMenu>
      <Hint label={hint}>
        <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent align="end" className="w-64">
        {templateGroups(kind).map((g, i) => (
          <DropdownMenuGroup key={g.label}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>{g.label}</DropdownMenuLabel>
            {g.templates.map((t) => (
              <DropdownMenuItem key={t.id} onSelect={() => onCreate(t.id)}>
                <span aria-hidden>{t.emoji}</span> {t.menuLabel ?? t.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** What can be done with a case file of the list; shown in its context menu and its ⋯ menu. */
interface ItemAction {
  label: string
  icon: LucideIcon
  onSelect: () => void
  destructive?: boolean
}

function CaseFileList({ kind, api, me, onCreate, onDelete }: ListProps) {
  const [query, setQuery] = useState("")
  const [renamingId, setRenamingId] = useState<string>()
  const navigate = useNavigate()

  // Searched in the title, the template and everything entered.
  const texts = useMemo(() => new Map(api.caseFiles.map((a) => [a.id, caseFileText(a).toLowerCase()])), [api.caseFiles])
  const q = query.trim().toLowerCase()
  const shown = q
    ? api.caseFiles.filter(
        (a) =>
          [caseFileTitle(a, me, kind.templates), kind.templates[a.docs[0].template].label].some((s) =>
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
    const main = kind.templates[a.docs[0].template]
    const attached = a.docs.length - 1
    // The list is sorted by the last change, so that's the date it shows.
    const meta = (
      <span className="text-xs text-muted-foreground/70">
        {main.label} · geändert {formatDateTime(a.updatedAt)}
        {attached > 0 && ` · +${attached} ${attached === 1 ? "Dokument" : "Dokumente"}`}
      </span>
    )
    const icon = a.settled ? (
      <CircleCheckIcon aria-label="Erledigt" className="inline size-3.5 align-[-2px] text-emerald-400" />
    ) : (
      <span aria-hidden>{main.emoji}</span>
    )
    // While renaming, the row is no link, so clicks into the field don't navigate.
    if (renamingId === a.id)
      return (
        <div key={a.id} className={EXPLORER_CARD}>
          <span className="flex items-center gap-1 text-sm font-medium">
            {icon}
            <InlineEdit
              value={caseFileTitle(a, me, kind.templates)}
              allowEmpty
              onDone={(title) => {
                if (title !== undefined) api.rename(a.id, title)
                setRenamingId(undefined)
              }}
              placeholder={caseFileTitle({ ...a, title: "" }, me, kind.templates)}
              aria-label={`Titel der ${kind.noun}`}
            />
          </span>
          {meta}
        </div>
      )
    return (
      <div key={a.id} className="group/item relative">
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <Link
              to={casePath(kind, a.id)}
              onKeyDown={(e) => {
                if (e.key === "F2") {
                  e.preventDefault()
                  setRenamingId(a.id)
                }
              }}
              className={EXPLORER_CARD}
            >
              <WithIds text={caseFileTitle(a, me, kind.templates)} className="text-sm font-medium">
                {icon}{" "}
              </WithIds>
              {meta}
            </Link>
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
        {/* The same actions without a right click; shown on hover and focus. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Aktionen für „${caseFileTitle(a, me, kind.templates)}"`}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground opacity-0 group-focus-within/item:opacity-100 group-hover/item:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
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
      </div>
    )
  }

  const open = shown.filter((a) => !a.settled)
  const settled = shown.filter((a) => a.settled)
  const templates = searchTemplates(kind, query)

  return (
    <Explorer
      title={kind.title}
      toolbar={
        <>
          <SearchField value={query} onChange={setQuery} focusKey aria-label={`${kind.title} durchsuchen`} />
          <NewCaseFileMenu kind={kind} onCreate={onCreate} hint={`Neue ${kind.noun}`}>
            <Button>
              <PlusIcon /> Neue {kind.noun}
            </Button>
          </NewCaseFileMenu>
        </>
      }
    >
      <div className="grid gap-4">
        {api.caseFiles.length === 0 && <Home kind={kind} />}
        {open.length > 0 && (
          <section className="grid gap-1.5">
            <ListHeading>Offen</ListHeading>
            <nav className={EXPLORER_CARDS}>{open.map(row)}</nav>
          </section>
        )}
        {settled.length > 0 && (
          <section className="grid gap-1.5">
            <ListHeading>Erledigt</ListHeading>
            <nav className={EXPLORER_CARDS}>{settled.map(row)}</nav>
          </section>
        )}
        <TemplateList kind={kind} templates={templates} onCreate={onCreate} />
      </div>
      {q && shown.length === 0 && templates.length === 0 && (
        <NoResults query={query} onReset={() => setQuery("")} />
      )}
    </Explorer>
  )
}

function ListHeading({ children }: { children: ReactNode }) {
  return <h3 className="px-1 text-xs font-medium text-muted-foreground">{children}</h3>
}

/** Shown above the templates while nothing was created yet. */
function Home({ kind }: { kind: CaseFileKind }) {
  return (
    <Empty className="p-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderOpenIcon />
        </EmptyMedia>
        <EmptyTitle>{kind.empty.title}</EmptyTitle>
        <EmptyDescription>{kind.empty.description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
