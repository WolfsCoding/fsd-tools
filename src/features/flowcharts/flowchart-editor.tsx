import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactElement } from "react"
import {
  ArrowDownIcon,
  ArrowRightIcon,
  CheckIcon,
  CopyIcon,
  ImageDownIcon,
  ImageIcon,
  ListTreeIcon,
  MergeIcon,
  MoonIcon,
  PencilIcon,
  PlusIcon,
  SplitIcon,
  SunIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { BackButton } from "@/components/explorer"
import { Hint } from "@/components/hint"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useTabTitle } from "@/hooks/use-tabs"
import { removedToast } from "@/lib/undo"
import { FLOWCHARTS_BASE } from "./paths"
import {
  boxAt,
  COLOR_LABELS,
  drawFlow,
  flowchartPng,
  layoutFlow,
  loadFonts,
  nodeColor,
  pngFileName,
  SWATCHES,
} from "./render"
import {
  countNodes,
  findParent,
  flatten,
  insertChild,
  linkTargets,
  mapNode,
  moveNode,
  newLink,
  newNode,
  removeNode,
  stepsById,
} from "./tree"
import { NODE_COLORS, type FlowDirection, type FlowNode, type FlowTheme, type Flowchart, type NodeColor } from "./types"
import { flowchartTitle, type FlowchartPatch } from "./use-flowcharts"

type OnChange = (patch: FlowchartPatch | ((chart: Flowchart) => FlowchartPatch)) => void

/** The steps as a tree on one side, the finished picture on the other. */
export function FlowchartEditor({
  chart,
  onChange,
  autoFocus = false,
}: {
  chart: Flowchart
  onChange: OnChange
  /** Focuses the first step, e.g. for a flowchart that was just created. */
  autoFocus?: boolean
}) {
  useTabTitle(flowchartTitle(chart))
  const outlineRef = useRef<HTMLDivElement>(null)
  const [selectedId, setSelectedId] = useState<string>()
  // The step to focus once it has rendered, e.g. one that was just added.
  const pendingFocus = useRef<string | undefined>(autoFocus ? chart.root.id : undefined)
  const focusStep = (id: string) =>
    outlineRef.current?.querySelector<HTMLInputElement>(`[data-flow-node="${id}"]`)?.focus()
  const setFocusId = (id: string) => {
    pendingFocus.current = id
  }

  useEffect(() => {
    if (!pendingFocus.current) return
    focusStep(pendingFocus.current)
    pendingFocus.current = undefined
  })

  const editRoot = (fn: (root: FlowNode) => FlowNode) => onChange((latest) => ({ root: fn(latest.root) }))
  const inputs = () => [...(outlineRef.current?.querySelectorAll<HTMLInputElement>("[data-flow-node]") ?? [])]

  const actions: StepActions = {
    setText: (id, text) => editRoot((r) => mapNode(r, id, (n) => ({ ...n, text }))),
    setColor: (id, color) =>
      editRoot((r) => mapNode(r, id, (n) => ({ ...n, color: color === "default" ? undefined : color }))),
    addStep: (id) => {
      const node = newNode()
      editRoot((r) => insertChild(r, id, node))
      setFocusId(node.id)
    },
    addBranch: (id) => {
      const at = findParent(chart.root, id)
      if (!at) return
      const node = newNode()
      editRoot((r) => insertChild(r, at.parent.id, node, at.index + 1))
      setFocusId(node.id)
    },
    move: (id, delta) => {
      editRoot((r) => moveNode(r, id, delta))
      setFocusId(id)
    },
    remove: (id, { quiet = false, focus } = {}) => {
      const at = findParent(chart.root, id)
      if (!at) return
      const node = at.parent.children[at.index]
      editRoot((r) => removeNode(r, id))
      setFocusId(focus ?? at.parent.id)
      if (quiet) return
      const label =
        node.linkTo !== undefined ? "Verbindung" : node.text.trim() ? `Schritt „${node.text.trim()}“` : "Schritt"
      removedToast(label, () =>
        // Back where it was, unless it's there already or its parent is gone too.
        editRoot((r) => (hasNode(r, id) || !hasNode(r, at.parent.id) ? r : insertChild(r, at.parent.id, node, at.index))),
      )
    },
    focusSibling: (from, delta) => {
      const all = inputs()
      all[all.findIndex((el) => el.dataset.flowNode === from) + delta]?.focus()
    },
    previousId: (id) => {
      const all = inputs()
      return all[all.findIndex((el) => el.dataset.flowNode === id) - 1]?.dataset.flowNode
    },
    select: setSelectedId,
    linkTargets: (sourceId) => linkTargets(chart.root, sourceId),
    addLink: (sourceId, targetId) => {
      editRoot((r) => insertChild(r, sourceId, newLink(targetId)))
      setFocusId(sourceId)
    },
    setLink: (id, targetId) => editRoot((r) => mapNode(r, id, (n) => ({ ...n, linkTo: targetId }))),
    stepById: (id) => stepsById(chart.root).get(id),
    parentOf: (id) => findParent(chart.root, id)?.parent,
  }

  const steps = countNodes(chart.root)
  const splits = flatten(chart.root).filter((s) => s.node.children.length > 1).length

  return (
    // Side by side once the editor itself is wide enough.
    <div className="@container flex min-h-0 flex-1">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 @3xl:flex-row @3xl:overflow-hidden">
        <Card className="shrink-0 @3xl:min-h-0 @3xl:w-[22rem] @5xl:w-[28rem]">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <BackButton to={FLOWCHARTS_BASE} label="Alle Ablaufdiagramme" className="-ml-1" />
              <ListTreeIcon className="size-4 text-muted-foreground" />
              Schritte
            </CardTitle>
            <CardDescription>
              {steps} {steps === 1 ? "Schritt" : "Schritte"}
              {splits > 0 && ` · ${splits} ${splits === 1 ? "Verzweigung" : "Verzweigungen"}`}
            </CardDescription>
          </CardHeader>
  
          <CardContent ref={outlineRef} className="min-h-0 flex-1 overflow-y-auto">
            <ul>
              <StepTree node={chart.root} depth={0} last actions={actions} split={false} />
            </ul>
          </CardContent>
  
          <CardFooter className="hidden flex-wrap gap-x-4 gap-y-1.5 border-t text-xs text-muted-foreground @3xl:flex">
            <span className="flex items-center gap-1.5">
              <Kbd>Enter</Kbd> nächster Schritt
            </span>
            <span className="flex items-center gap-1.5">
              <KbdGroup>
                <Kbd>Umschalt</Kbd>
                <Kbd>Enter</Kbd>
              </KbdGroup>
              Verzweigung
            </span>
            <span className="flex items-center gap-1.5">
              <KbdGroup>
                <Kbd>Alt</Kbd>
                <Kbd>↑↓</Kbd>
              </KbdGroup>
              verschieben
            </span>
          </CardFooter>
        </Card>
  
        <Preview chart={chart} onChange={onChange} selectedId={selectedId} onSelect={focusStep} />
      </div>
    </div>
  )
}

function hasNode(root: FlowNode, id: string): boolean {
  return root.id === id || root.children.some((c) => hasNode(c, id))
}

interface StepActions {
  setText: (id: string, text: string) => void
  setColor: (id: string, color: NodeColor) => void
  /** Adds a step after `id`; if `id` already has one, this splits the path. */
  addStep: (id: string) => void
  /** Adds another way next to `id`, i.e. another child of its parent. */
  addBranch: (id: string) => void
  move: (id: string, delta: number) => void
  /** Removes `id` and the steps after it. `quiet` skips the undo toast. */
  remove: (id: string, options?: { quiet?: boolean; focus?: string }) => void
  focusSibling: (from: string, delta: number) => void
  previousId: (id: string) => string | undefined
  select: (id: string | undefined) => void
  /** Steps a link from `sourceId` may lead to. */
  linkTargets: (sourceId: string) => FlowNode[]
  /** Lets `sourceId` lead on to the existing step `targetId`, so two paths end in one step. */
  addLink: (sourceId: string, targetId: string) => void
  setLink: (id: string, targetId: string) => void
  stepById: (id: string) => FlowNode | undefined
  parentOf: (id: string) => FlowNode | undefined
}

/** A step and, below it, the steps after it, joined by tree lines. */
function StepTree({
  node,
  depth,
  last,
  split,
  actions,
}: {
  node: FlowNode
  depth: number
  /** Last of its siblings: the line down to the next sibling ends here. */
  last: boolean
  /** One of several ways out of its parent; its lines are tinted. */
  split: boolean
  actions: StepActions
}) {
  const line = split ? "border-primary/50" : "border-border"
  return (
    <li className="relative">
      {depth > 0 && (
        <>
          {/* Elbow from the parent's line into this row (h-9, so its middle is 1.125rem down). */}
          <span
            aria-hidden
            className={cn("absolute -top-2 -left-5 h-[1.625rem] w-4 rounded-bl-lg border-b-2 border-l-2", line)}
          />
          {!last && <span aria-hidden className={cn("absolute -top-2 bottom-0 -left-5 border-l-2", line)} />}
        </>
      )}
      {node.linkTo === undefined ? (
        <StepRow node={node} depth={depth} actions={actions} />
      ) : (
        <LinkRow link={node} actions={actions} />
      )}
      {node.children.length > 0 && (
        <ul className="ml-[1.125rem] space-y-2 pt-2 pl-5">
          {node.children.map((c, i) => (
            <StepTree
              key={c.id}
              node={c}
              depth={depth + 1}
              last={i === node.children.length - 1}
              split={node.children.length > 1}
              actions={actions}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function StepRow({ node, depth, actions }: { node: FlowNode; depth: number; actions: StepActions }) {
  const isRoot = depth === 0
  const color = nodeColor(node, isRoot)

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return
    const el = e.currentTarget
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault()
      if (isRoot) actions.addStep(node.id)
      else actions.addBranch(node.id)
    } else if (e.key === "Enter") {
      e.preventDefault()
      actions.addStep(node.id)
    } else if (e.key === "Backspace" && !isRoot && !el.value && node.children.length === 0) {
      e.preventDefault()
      actions.remove(node.id, { quiet: true, focus: actions.previousId(node.id) })
    } else if ((e.key === "ArrowUp" || e.key === "ArrowDown") && e.altKey) {
      e.preventDefault()
      actions.move(node.id, e.key === "ArrowUp" ? -1 : 1)
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault()
      actions.focusSibling(node.id, e.key === "ArrowUp" ? -1 : 1)
    }
  }

  return (
    <InputGroup className={cn("group/step bg-background", isRoot && "h-10")}>
      <InputGroupAddon>
        <DropdownMenu>
          <Hint label="Farbe">
            <DropdownMenuTrigger asChild>
              <InputGroupButton size="icon-xs" aria-label={`Farbe: ${COLOR_LABELS[color]}`}>
                <ColorDot color={color} />
              </InputGroupButton>
            </DropdownMenuTrigger>
          </Hint>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuLabel>Farbe</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={color} onValueChange={(v) => actions.setColor(node.id, v as NodeColor)}>
              {NODE_COLORS.map((c) => (
                <DropdownMenuRadioItem key={c} value={c}>
                  <ColorDot color={c} /> {COLOR_LABELS[c]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </InputGroupAddon>

      <InputGroupInput
        data-flow-node={node.id}
        value={node.text}
        onChange={(e) => actions.setText(node.id, e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => actions.select(node.id)}
        onBlur={() => actions.select(undefined)}
        placeholder={isRoot ? "Frage oder Ausgangslage…" : "Schritt…"}
        aria-label={isRoot ? "Titel" : "Schritt"}
        className={cn(isRoot && "font-semibold")}
      />

      <InputGroupAddon
        align="inline-end"
        // Stays while the step picker is open, which takes the focus out of the row.
        className="hidden group-focus-within/step:flex group-hover/step:flex has-aria-expanded:flex pointer-coarse:flex"
      >
        <Hint label="Nächster Schritt (Enter)">
          <InputGroupButton size="icon-xs" onClick={() => actions.addStep(node.id)} aria-label="Nächster Schritt">
            <PlusIcon />
          </InputGroupButton>
        </Hint>
        {!isRoot && (
          <>
            <StepPicker
              label="Mit vorhandenem Schritt verbinden"
              targets={() => actions.linkTargets(node.id)}
              onPick={(target) => actions.addLink(node.id, target)}
            >
              <InputGroupButton size="icon-xs" aria-label="Mit vorhandenem Schritt verbinden">
                <MergeIcon />
              </InputGroupButton>
            </StepPicker>
            <Hint label="Verzweigung (Umschalt+Enter)">
              <InputGroupButton
                size="icon-xs"
                onClick={() => actions.addBranch(node.id)}
                aria-label="Verzweigung hinzufügen"
              >
                <SplitIcon />
              </InputGroupButton>
            </Hint>
            <Hint label="Löschen">
              <InputGroupButton
                size="icon-xs"
                onClick={() => actions.remove(node.id)}
                aria-label="Schritt löschen"
                className="hover:text-destructive"
              >
                <Trash2Icon />
              </InputGroupButton>
            </Hint>
          </>
        )}
      </InputGroupAddon>
    </InputGroup>
  )
}

/** A way from its parent into a step that lives elsewhere in the tree. */
function LinkRow({ link, actions }: { link: FlowNode; actions: StepActions }) {
  const target = link.linkTo === undefined ? undefined : actions.stepById(link.linkTo)
  const parent = actions.parentOf(link.id)
  return (
    <div className="group/step flex h-9 items-center gap-2 rounded-lg border border-dashed border-primary/50 bg-primary/5 pr-1.5 pl-2.5 text-sm">
      <MergeIcon className="size-4 shrink-0 text-primary" />
      {target ? (
        <span className="min-w-0 flex-1 truncate">
          <span className="text-muted-foreground">Weiter zu </span>
          <span className="font-medium">{target.text.trim() || "Ohne Text"}</span>
        </span>
      ) : (
        <span className="min-w-0 flex-1 truncate text-destructive">Ziel wurde gelöscht</span>
      )}
      <div className="hidden group-focus-within/step:flex group-hover/step:flex has-aria-expanded:flex pointer-coarse:flex">
        {parent && (
          <StepPicker
            label="Ziel ändern"
            targets={() => actions.linkTargets(parent.id).filter((s) => s.id !== link.linkTo).concat(target ? [target] : [])}
            current={link.linkTo}
            onPick={(id) => actions.setLink(link.id, id)}
          >
            <Button variant="ghost" size="icon-xs" aria-label="Ziel ändern">
              <PencilIcon />
            </Button>
          </StepPicker>
        )}
        <Hint label="Verbindung löschen">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => actions.remove(link.id)}
            aria-label="Verbindung löschen"
            className="hover:text-destructive"
          >
            <Trash2Icon />
          </Button>
        </Hint>
      </div>
    </div>
  )
}

/** Searchable list of steps to connect to; `targets` is read when it opens. */
function StepPicker({
  label,
  targets,
  current,
  onPick,
  children,
}: {
  label: string
  targets: () => FlowNode[]
  current?: string
  onPick: (id: string) => void
  children: ReactElement
}) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<FlowNode[]>([])
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setItems(targets())
        setOpen(next)
      }}
    >
      <Hint label={label}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
      </Hint>
      <PopoverContent align="end" className="w-72 gap-0 p-0">
        <Command className="rounded-lg!">
          <CommandInput placeholder="Schritt suchen…" />
          <CommandList>
            <CommandEmpty>Kein passender Schritt.</CommandEmpty>
            <CommandGroup heading="Weiter zu">
              {items.map((s) => (
                <CommandItem
                  key={s.id}
                  value={s.id}
                  keywords={[s.text]}
                  onSelect={() => {
                    onPick(s.id)
                    setOpen(false)
                  }}
                >
                  <ColorDot color={nodeColor(s, false)} />
                  <span className="truncate">{s.text.trim() || "Ohne Text"}</span>
                  {s.id === current && <CheckIcon className="ml-auto" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function ColorDot({ color }: { color: NodeColor }) {
  return (
    <span
      style={{ backgroundColor: SWATCHES[color].solid }}
      className="size-3 shrink-0 rounded-full ring-2 ring-foreground/10"
    />
  )
}

/** The picture as it will be exported, plus its options and the export buttons. */
function Preview({
  chart,
  onChange,
  selectedId,
  onSelect,
}: {
  chart: Flowchart
  onChange: OnChange
  selectedId: string | undefined
  onSelect: (id: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [fontsReady, setFontsReady] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    loadFonts().finally(() => active && setFontsReady(true))
    return () => {
      active = false
    }
  }, [])

  // Measuring before the font is there would size the boxes for the fallback font.
  const layout = useMemo(
    () => (fontsReady ? layoutFlow(chart.root, chart.direction) : undefined),
    [fontsReady, chart.root, chart.direction],
  )

  useEffect(() => {
    if (layout && canvasRef.current) drawFlow(canvasRef.current, layout, chart.theme, window.devicePixelRatio || 1, selectedId)
  }, [layout, chart.theme, selectedId])

  function onCanvasClick(e: MouseEvent<HTMLCanvasElement>) {
    if (!layout) return
    const rect = e.currentTarget.getBoundingClientRect()
    const scale = layout.width / rect.width
    const box = boxAt(layout, (e.clientX - rect.left) * scale, (e.clientY - rect.top) * scale)
    if (box) onSelect(box.node.id)
  }

  async function exportPng(mode: "copy" | "download") {
    setBusy(true)
    try {
      if (mode === "copy") {
        // Passing the promise keeps the user gesture alive in Safari while the PNG is drawn.
        await navigator.clipboard.write([new ClipboardItem({ "image/png": flowchartPng(chart) })])
        toast.success("Bild kopiert", { description: "Mit Strg+V z. B. in Discord einfügen." })
      } else {
        const url = URL.createObjectURL(await flowchartPng(chart))
        const a = document.createElement("a")
        a.href = url
        a.download = pngFileName(chart.root.text)
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    } catch {
      toast.error(mode === "copy" ? "Kopieren nicht möglich – lade das Bild stattdessen herunter." : "Export fehlgeschlagen")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="min-h-[24rem] min-w-0 flex-1 pb-0 @3xl:min-h-0">
      <CardHeader className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b">
        <div className="mr-auto grid gap-1">
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="size-4 text-muted-foreground" />
            Vorschau
          </CardTitle>
          <CardDescription>Klick auf einen Schritt, um ihn zu bearbeiten.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={chart.direction}
            onValueChange={(v) => v && onChange({ direction: v as FlowDirection })}
            aria-label="Richtung"
          >
            <Hint label="Von oben nach unten">
              <ToggleGroupItem value="down" aria-label="Von oben nach unten">
                <ArrowDownIcon />
              </ToggleGroupItem>
            </Hint>
            <Hint label="Von links nach rechts">
              <ToggleGroupItem value="right" aria-label="Von links nach rechts">
                <ArrowRightIcon />
              </ToggleGroupItem>
            </Hint>
          </ToggleGroup>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={chart.theme}
            onValueChange={(v) => v && onChange({ theme: v as FlowTheme })}
            aria-label="Hintergrund"
          >
            <Hint label="Dunkel">
              <ToggleGroupItem value="dark" aria-label="Dunkel">
                <MoonIcon />
              </ToggleGroupItem>
            </Hint>
            <Hint label="Hell">
              <ToggleGroupItem value="light" aria-label="Hell">
                <SunIcon />
              </ToggleGroupItem>
            </Hint>
          </ToggleGroup>
          <Separator orientation="vertical" className="mx-1 h-5!" />
          <Button variant="outline" size="sm" onClick={() => exportPng("copy")} disabled={busy}>
            <CopyIcon /> Kopieren
          </Button>
          <Button size="sm" onClick={() => exportPng("download")} disabled={busy}>
            <ImageDownIcon /> PNG
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 px-0">
        {/* A dotted board, so the image's rounded corners show. */}
        <div className="flex min-h-0 flex-1 overflow-auto bg-[radial-gradient(var(--color-border)_1px,transparent_1px)] [background-size:14px_14px] p-6">
          {layout && (
            <canvas
              ref={canvasRef}
              onClick={onCanvasClick}
              style={{ width: layout.width, aspectRatio: `${layout.width} / ${layout.height}` }}
              className="m-auto h-auto max-w-full shrink-0 cursor-pointer drop-shadow-xl"
              role="img"
              aria-label={`Vorschau: ${flowchartTitle(chart)}`}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
