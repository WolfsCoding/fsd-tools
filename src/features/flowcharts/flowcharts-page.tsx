import { useMemo, useState } from "react"
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router"
import { CopyPlusIcon, EllipsisIcon, PlusIcon, SparklesIcon, Trash2Icon, WorkflowIcon } from "lucide-react"
import { Explorer, EXPLORER_CARDS, EXPLORER_CARD } from "@/components/explorer"
import { NoResults } from "@/components/no-results"
import { SearchField } from "@/components/search-field"
import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { useRegisterCommands, type CommandGroupDef } from "@/hooks/use-command-palette"
import { formatRelative } from "@/lib/format-date"
import { removedToast } from "@/lib/undo"
import { FlowchartEditor } from "./flowchart-editor"
import { flowchartPath } from "./paths"
import { countNodes, flatten } from "./tree"
import type { Flowchart } from "./types"
import { flowchartTitle, useFlowcharts } from "./use-flowcharts"

type FlowchartsApi = ReturnType<typeof useFlowcharts>

interface ListActions {
  /** Creates a flowchart, the example one if asked, and opens it. */
  onCreate: (example?: boolean) => void
  /** The flowchart created last, whose editor focuses its first step. */
  createdId: string | undefined
  onDuplicate: (chart: Flowchart) => void
  onDelete: (chart: Flowchart) => void
}

/** Paths of steps that can split, exported as a PNG to post. */
export function FlowchartsPage() {
  const api = useFlowcharts()
  const navigate = useNavigate()
  const [createdId, setCreatedId] = useState<string | undefined>()

  const actions = useMemo<ListActions>(
    () => ({
      onCreate: (example = false) => {
        const id = api.createFlowchart(example)
        if (!example) setCreatedId(id)
        navigate(flowchartPath(id))
      },
      createdId,
      onDuplicate: (chart) => {
        const id = api.createFlowchart()
        // Fresh ids, so steps of the copy never collide with the original's; links follow along.
        const copy = structuredClone(chart.root)
        const nodes = flatten(copy).map((s) => s.node)
        const ids = new Map(nodes.map((n) => [n.id, crypto.randomUUID()]))
        for (const node of nodes) {
          node.id = ids.get(node.id)!
          if (node.linkTo !== undefined) node.linkTo = ids.get(node.linkTo) ?? node.linkTo
        }
        copy.text = `${chart.root.text} (Kopie)`.trim()
        api.updateFlowchart(id, { root: copy, direction: chart.direction, theme: chart.theme })
        navigate(flowchartPath(id))
      },
      onDelete: (chart) =>
        removedToast(`Ablaufdiagramm „${flowchartTitle(chart)}"`, api.deleteFlowchart(chart.id)),
    }),
    [api, navigate, createdId],
  )

  const commandGroups = useMemo<CommandGroupDef[]>(
    () => [
      {
        heading: "Ablaufdiagramme",
        items: [{ id: "flowcharts:new", label: "Neues Ablaufdiagramm", icon: PlusIcon, onSelect: () => actions.onCreate() }],
      },
      {
        heading: "Alle Ablaufdiagramme",
        actionLabel: "Ablaufdiagramm öffnen",
        items: api.charts.map((c) => ({
          id: `flowcharts:chart:${c.id}`,
          label: flowchartTitle(c),
          keywords: [flatten(c.root).map((s) => s.node.text).join(" ").slice(0, 500)],
          icon: WorkflowIcon,
          onSelect: () => navigate(flowchartPath(c.id)),
        })),
      },
    ],
    [api, navigate, actions],
  )
  useRegisterCommands("flowcharts", commandGroups)

  return (
    <Routes>
      <Route index element={<ChartList api={api} actions={actions} />} />
      <Route path=":chartId" element={<ChartRoute api={api} actions={actions} />} />
    </Routes>
  )
}

function ChartRoute({ api, actions }: { api: FlowchartsApi; actions: ListActions }) {
  const { chartId } = useParams()
  const chart = api.charts.find((c) => c.id === chartId)
  if (!chart) return <Navigate to=".." replace />
  return (
    <FlowchartEditor
      key={chart.id}
      chart={chart}
      onChange={(patch) => api.updateFlowchart(chart.id, patch)}
      autoFocus={chart.id === actions.createdId}
    />
  )
}

function ChartList({ api, actions }: { api: FlowchartsApi; actions: ListActions }) {
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const shown = q
    ? api.charts.filter((c) => flatten(c.root).some((s) => s.node.text.toLowerCase().includes(q)))
    : api.charts

  if (api.charts.length === 0) return <Home onCreate={actions.onCreate} />

  return (
    <Explorer
      title="Ablaufdiagramme"
      toolbar={
        <>
          <SearchField value={query} onChange={setQuery} aria-label="Ablaufdiagramme durchsuchen" focusKey />
          <Button onClick={() => actions.onCreate()}>
            <PlusIcon /> Neues Ablaufdiagramm
          </Button>
        </>
      }
    >
      <nav className={EXPLORER_CARDS}>
        {shown.map((c) => {
          const steps = countNodes(c.root)
          const items = [
            { label: "Duplizieren", icon: CopyPlusIcon, onSelect: () => actions.onDuplicate(c) },
            { label: "Löschen", icon: Trash2Icon, onSelect: () => actions.onDelete(c), destructive: true },
          ]
          return (
            <div key={c.id} className="group relative">
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <Link to={flowchartPath(c.id)} className={EXPLORER_CARD}>
                    <span className="truncate text-sm font-medium">{flowchartTitle(c)}</span>
                    <span className="text-xs text-muted-foreground/70">
                      {formatRelative(c.updatedAt)} · {steps} {steps === 1 ? "Schritt" : "Schritte"}
                    </span>
                  </Link>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  {items.map((item) => (
                    <ContextMenuItem
                      key={item.label}
                      variant={item.destructive ? "destructive" : undefined}
                      onSelect={item.onSelect}
                    >
                      <item.icon /> {item.label}
                    </ContextMenuItem>
                  ))}
                </ContextMenuContent>
              </ContextMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Aktionen für „${flowchartTitle(c)}"`}
                    className="absolute top-1/2 right-2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100"
                  >
                    <EllipsisIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  {items.map((item) => (
                    <DropdownMenuItem
                      key={item.label}
                      variant={item.destructive ? "destructive" : undefined}
                      onSelect={item.onSelect}
                    >
                      <item.icon /> {item.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        })}
      </nav>
      {q && shown.length === 0 && <NoResults query={query} onReset={() => setQuery("")} />}
    </Explorer>
  )
}

function Home({ onCreate }: { onCreate: (example?: boolean) => void }) {
  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <WorkflowIcon />
        </EmptyMedia>
        <EmptyTitle>Noch keine Ablaufdiagramme</EmptyTitle>
        <EmptyDescription>
          Bau einen Ablauf Schritt für Schritt, verzweige ihn wo nötig und exportiere ihn als PNG zum Posten.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center">
        <Button onClick={() => onCreate()}>
          <PlusIcon /> Neues Ablaufdiagramm
        </Button>
        <Button variant="outline" onClick={() => onCreate(true)}>
          <SparklesIcon /> Beispiel
        </Button>
      </EmptyContent>
    </Empty>
  )
}
