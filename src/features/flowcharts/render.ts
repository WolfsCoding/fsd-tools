import type { FlowDirection, FlowNode, FlowTheme, Flowchart, NodeColor } from "./types"
import { nextSteps, stepsById } from "./tree"

const FONT_FAMILY = '"Inter Variable", system-ui, sans-serif'
const FONT = `500 14px ${FONT_FAMILY}`
const ROOT_FONT = `650 16px ${FONT_FAMILY}`
const LINE_HEIGHT = 20
const ROOT_LINE_HEIGHT = 22
/** Text wider than this wraps onto the next line. */
const MAX_TEXT_WIDTH = 220
const ROOT_MAX_TEXT_WIDTH = 320
const MIN_NODE_WIDTH = 72
const PAD_X = 18
const PAD_Y = 12
const RADIUS = 12
/** Space around the whole chart. */
const MARGIN = 40
/** Corner radius of the whole image; the corners outside it stay transparent. */
const IMAGE_RADIUS = 20
/** Corner radius where a connector bends. */
const ELBOW_RADIUS = 10
/**
 * Space between a step and the next one, between the branches of a split, and between the
 * lanes that links run on.
 */
const GAP = { down: { level: 52, sibling: 20, lane: 10 }, right: { level: 72, sibling: 16, lane: 12 } }
/** Room along a lane between the ends of two links before they need lanes of their own. */
const LANE_CLEARANCE = 16
/** Pixels per CSS pixel in the PNG, so it stays sharp when zoomed in. */
export const EXPORT_SCALE = 2

interface Swatch {
  fill: string
  border: string
  /** Fill of the first step, which is drawn solid with white text. */
  solid: string
}

interface Theme {
  /** Top and bottom of the background gradient. */
  background: [string, string]
  /** Hairline around the whole image. */
  frame: string
  text: string
  placeholder: string
  edge: string
  shadow: string
  selection: string
  colors: Record<NodeColor, Swatch>
}

const THEMES: Record<FlowTheme, Theme> = {
  dark: {
    background: ["#232428", "#1a1b1e"],
    frame: "rgba(255, 255, 255, 0.08)",
    text: "#e6e7ea",
    placeholder: "#6f737a",
    edge: "#5c6068",
    shadow: "rgba(0, 0, 0, 0.45)",
    selection: "#548af7",
    colors: {
      default: { fill: "#2e3034", border: "#45484f", solid: "#4a4d55" },
      blue: { fill: "#1c2b48", border: "#3d7bf2", solid: "#3574f0" },
      green: { fill: "#1b3222", border: "#4fae58", solid: "#3f9a47" },
      amber: { fill: "#372b18", border: "#e0a03f", solid: "#c98a2c" },
      red: { fill: "#3d1f26", border: "#ef4f60", solid: "#e5434f" },
      purple: { fill: "#342235", border: "#bf72b3", solid: "#a85b9c" },
    },
  },
  light: {
    background: ["#ffffff", "#f5f6f8"],
    frame: "rgba(0, 0, 0, 0.08)",
    text: "#1f2024",
    placeholder: "#9a9da3",
    edge: "#b0b4bc",
    shadow: "rgba(30, 35, 45, 0.12)",
    selection: "#3574f0",
    colors: {
      default: { fill: "#ffffff", border: "#d6d8de", solid: "#4a4d55" },
      blue: { fill: "#edf3fe", border: "#3574f0", solid: "#3574f0" },
      green: { fill: "#ebf7ec", border: "#3f9a47", solid: "#3f9a47" },
      amber: { fill: "#fdf5e6", border: "#c98a2c", solid: "#c98a2c" },
      red: { fill: "#fdecee", border: "#e5434f", solid: "#e5434f" },
      purple: { fill: "#f8edf6", border: "#a85b9c", solid: "#a85b9c" },
    },
  },
}

/** Swatch colors of the dark theme, for the color picker. */
export const SWATCHES = THEMES.dark.colors

export const COLOR_LABELS: Record<NodeColor, string> = {
  default: "Standard",
  blue: "Blau",
  green: "Grün",
  amber: "Gelb",
  red: "Rot",
  purple: "Lila",
}

/** The color a node is drawn in; the first step is blue unless set otherwise. */
export function nodeColor(node: FlowNode, isRoot: boolean): NodeColor {
  return node.color ?? (isRoot ? "blue" : "default")
}

export interface Box {
  node: FlowNode
  isRoot: boolean
  /** Level along the flow: the longest way from the first step, so a step that several paths lead to sits below all of them. */
  depth: number
  x: number
  y: number
  w: number
  h: number
  lines: string[]
  /** The steps directly under this one in the outline; they get their own room across the flow. */
  children: Box[]
}

/** A line from one step to the next; "link" for the extra ways into a step that several paths lead to. */
export interface Edge {
  from: Box
  to: Box
  kind: "tree" | "link"
  /** Where the line leaves `from` and enters `to`, across the flow direction. */
  fromCross: number
  toCross: number
  /** Where the line runs sideways, along the flow direction. */
  bus: number
  /** For links: the level whose gap holds the lane, and the lane in it (1 = nearest the split line). */
  gapLevel: number
  lane: number
}

export interface FlowLayout {
  width: number
  height: number
  direction: FlowDirection
  /** Every box, parents before their children. */
  boxes: Box[]
  edges: Edge[]
}

let measureContext: CanvasRenderingContext2D | null = null

function measure() {
  measureContext ??= document.createElement("canvas").getContext("2d")!
  return measureContext
}

/** Splits `text` into lines no wider than `max`; overlong words are broken up. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const lines: string[] = []
  for (const paragraph of text.split("\n")) {
    let line = ""
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word
      if (ctx.measureText(candidate).width <= max) {
        line = candidate
        continue
      }
      if (line) lines.push(line)
      line = ""
      for (const char of word) {
        if (line && ctx.measureText(line + char).width > max) {
          lines.push(line)
          line = ""
        }
        line += char
      }
    }
    lines.push(line)
  }
  return lines
}

/** Positions every step: levels follow the direction, splits fan out across it. */
export function layoutFlow(root: FlowNode, direction: FlowDirection): FlowLayout {
  const ctx = measure()
  const gap = GAP[direction]
  const down = direction === "down"
  const boxes: Box[] = []
  const steps = stepsById(root)

  // Longest way from the first step; the cap guards against circles in imported data.
  const levelOf = new Map<string, number>()
  const assign = (node: FlowNode, level: number) => {
    if ((levelOf.get(node.id) ?? -1) >= level || level > steps.size) return
    levelOf.set(node.id, level)
    for (const next of nextSteps(node, steps)) assign(next, level + 1)
  }
  assign(root, 0)

  const build = (node: FlowNode, isRoot: boolean): Box => {
    ctx.font = isRoot ? ROOT_FONT : FONT
    const lines = node.text.trim() ? wrap(ctx, node.text.trim(), isRoot ? ROOT_MAX_TEXT_WIDTH : MAX_TEXT_WIDTH) : [""]
    const textWidth = Math.max(...lines.map((l) => ctx.measureText(l || "…").width))
    const box: Box = {
      node,
      isRoot,
      depth: levelOf.get(node.id) ?? 0,
      x: 0,
      y: 0,
      w: Math.ceil(Math.max(MIN_NODE_WIDTH, textWidth + PAD_X * 2)),
      h: lines.length * (isRoot ? ROOT_LINE_HEIGHT : LINE_HEIGHT) + PAD_Y * 2,
      lines,
      children: [],
    }
    boxes.push(box)
    box.children = node.children.filter((c) => c.linkTo === undefined).map((c) => build(c, false))
    return box
  }
  const rootBox = build(root, true)

  const boxById = new Map(boxes.map((b) => [b.node.id, b]))
  const edges = boxes.flatMap((from) =>
    from.node.children.flatMap((c): Edge[] => {
      const route = { fromCross: 0, toCross: 0, bus: 0, gapLevel: 0, lane: 0 }
      if (c.linkTo === undefined) return [{ from, to: boxById.get(c.id)!, kind: "tree", ...route }]
      const to = boxById.get(c.linkTo)
      return to ? [{ from, to, kind: "link", ...route }] : []
    }),
  )

  const main = (b: Box) => (down ? b.h : b.w)
  const cross = (b: Box) => (down ? b.w : b.h)
  const crossStart = (b: Box) => (down ? b.x : b.y)
  const center = (b: Box) => crossStart(b) + cross(b) / 2
  const setCrossStart = (b: Box, value: number) => {
    if (down) b.x = value
    else b.y = value
  }

  // Room a branch needs across the direction: its own step or its children side by side.
  const extent = new Map<Box, number>()
  const measureExtent = (b: Box): number => {
    const kids = b.children.reduce((sum, c) => sum + measureExtent(c), 0) + gap.sibling * Math.max(0, b.children.length - 1)
    const value = Math.max(cross(b), kids)
    extent.set(b, value)
    return value
  }
  const total = measureExtent(rootBox)

  const place = (b: Box, start: number) => {
    const size = extent.get(b)!
    setCrossStart(b, start + (size - cross(b)) / 2)
    const kids = b.children.reduce((sum, c) => sum + extent.get(c)!, 0) + gap.sibling * Math.max(0, b.children.length - 1)
    let at = start + (size - kids) / 2
    for (const c of b.children) {
      place(c, at)
      at += extent.get(c)! + gap.sibling
    }
  }
  place(rootBox, MARGIN)

  const incoming = new Map<Box, Edge[]>()
  for (const e of edges) incoming.set(e.to, [...(incoming.get(e.to) ?? []), e])

  // A last step that several paths lead to moves to the middle of them, if nothing is in the way.
  for (const [b, into] of incoming) {
    if (into.length < 2 || b.children.length > 0) continue
    const start = crossStart(b) + into.reduce((sum, e) => sum + center(e.from), 0) / into.length - center(b)
    const free = boxes.every(
      (o) =>
        o === b ||
        o.depth !== b.depth ||
        start + cross(b) + gap.sibling <= crossStart(o) ||
        crossStart(o) + cross(o) + gap.sibling <= start,
    )
    if (free && start >= MARGIN && start + cross(b) <= MARGIN + total) setCrossStart(b, start)
  }

  // Each way into a step that several paths lead to gets its own spot on its edge, in the order
  // the paths come from, so the arrows stay apart.
  for (const [b, into] of incoming) {
    into.sort((p, q) => center(p.from) - center(q.from))
    for (const [i, e] of into.entries()) {
      e.fromCross = center(e.from)
      e.toCross = into.length === 1 ? center(b) : crossStart(b) + (cross(b) * (i + 1)) / (into.length + 1)
    }
  }

  // Links run sideways on lanes of their own just past the split line, so they never lie on top
  // of another line: in the gap before the step they lead to, or right after their source if its
  // own steps are in the way below it.
  const lanesBefore: number[] = []
  const lanesOf = new Map<number, Edge[]>()
  for (const e of edges) {
    if (e.kind !== "link") continue
    e.gapLevel = e.from.children.length === 0 ? e.to.depth : e.from.depth + 1
    lanesOf.set(e.gapLevel, [...(lanesOf.get(e.gapLevel) ?? []), e])
  }
  for (const [level, links] of lanesOf) {
    const ends: number[] = []
    const span = (e: Edge) => [Math.min(e.fromCross, e.toCross), Math.max(e.fromCross, e.toCross)]
    for (const e of links.sort((p, q) => span(p)[0] - span(q)[0])) {
      const [a, z] = span(e)
      let lane = ends.findIndex((end) => end + LANE_CLEARANCE <= a)
      if (lane === -1) lane = ends.push(z) - 1
      else ends[lane] = z
      e.lane = lane + 1
    }
    lanesBefore[level] = ends.length
  }

  // Each level is as deep as its biggest step, so all steps of a level line up; the gap before
  // it widens by the lanes it needs.
  const levelSize: number[] = []
  for (const b of boxes) levelSize[b.depth] = Math.max(levelSize[b.depth] ?? 0, main(b))
  const levels: number[] = []
  const splitLines: number[] = []
  let pos = MARGIN
  for (const [level, size] of levelSize.entries()) {
    if (level > 0) {
      splitLines[level] = pos + gap.level / 2
      pos += gap.level + (lanesBefore[level] ?? 0) * gap.lane
    }
    levels.push(pos)
    pos += size
  }
  const mainEnd = pos + MARGIN

  for (const b of boxes) {
    if (down) b.y = levels[b.depth]
    else b.x = levels[b.depth]
  }
  for (const e of edges) {
    e.bus = e.kind === "link" ? splitLines[e.gapLevel] + e.lane * gap.lane : splitLines[e.from.depth + 1]
  }

  const crossEnd = total + MARGIN * 2
  return {
    width: Math.ceil(down ? crossEnd : mainEnd),
    height: Math.ceil(down ? mainEnd : crossEnd),
    direction,
    boxes,
    edges,
  }
}

function roundRect(ctx: CanvasRenderingContext2D, b: Box, inset = 0) {
  ctx.beginPath()
  ctx.roundRect(b.x - inset, b.y - inset, b.w + inset * 2, b.h + inset * 2, RADIUS + inset)
}

function arrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, direction: FlowDirection) {
  const s = 4.5
  ctx.beginPath()
  if (direction === "down") {
    ctx.moveTo(x - s, y - s * 1.5)
    ctx.quadraticCurveTo(x, y - s * 1.1, x + s, y - s * 1.5)
  } else {
    ctx.moveTo(x - s * 1.5, y - s)
    ctx.quadraticCurveTo(x - s * 1.1, y, x - s * 1.5, y + s)
  }
  ctx.lineTo(x, y)
  ctx.closePath()
  ctx.fill()
}

/**
 * Lines from each step to the ones after it: straight out, sideways along their bus with rounded
 * bends, and into the next step with an arrow. The routes come from `layoutFlow`.
 */
function drawEdges(ctx: CanvasRenderingContext2D, layout: FlowLayout) {
  const down = layout.direction === "down"
  const gap = GAP[layout.direction].level
  // Draws in (main, cross) coordinates; for "down" main is y, for "right" it's x.
  const point = (main: number, cross: number): [number, number] => (down ? [cross, main] : [main, cross])

  for (const { from: a, to: b, fromCross: from, toCross: to, bus } of layout.edges) {
    const start = down ? a.y + a.h : a.x + a.w
    const end = (down ? b.y : b.x) - 2
    const r = Math.min(ELBOW_RADIUS, Math.abs(to - from) / 2, gap / 4)
    ctx.beginPath()
    ctx.moveTo(...point(start, from))
    if (r < 0.5) {
      ctx.lineTo(...point(end, to))
    } else {
      ctx.arcTo(...point(bus, from), ...point(bus, to), r)
      ctx.arcTo(...point(bus, to), ...point(end, to), r)
      ctx.lineTo(...point(end, to))
    }
    ctx.stroke()
    arrowHead(ctx, ...point(end + 2, to), layout.direction)
  }
}

/** Rounded background with a soft gradient; outside the corners stays transparent. */
function drawBackground(ctx: CanvasRenderingContext2D, layout: FlowLayout, theme: Theme) {
  const { width, height } = layout
  ctx.beginPath()
  ctx.roundRect(0, 0, width, height, IMAGE_RADIUS)
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, theme.background[0])
  gradient.addColorStop(1, theme.background[1])
  ctx.fillStyle = gradient
  ctx.fill()

  ctx.beginPath()
  ctx.roundRect(0.5, 0.5, width - 1, height - 1, IMAGE_RADIUS - 0.5)
  ctx.strokeStyle = theme.frame
  ctx.lineWidth = 1
  ctx.stroke()
}

/**
 * Draws the chart onto `canvas`, `scale` pixels per layout pixel. `selectedId` outlines one
 * step; it's for the preview only.
 */
export function drawFlow(
  canvas: HTMLCanvasElement,
  layout: FlowLayout,
  themeName: FlowTheme,
  scale: number,
  selectedId?: string,
) {
  const theme = THEMES[themeName]
  canvas.width = Math.round(layout.width * scale)
  canvas.height = Math.round(layout.height * scale)
  const ctx = canvas.getContext("2d")!
  ctx.setTransform(scale, 0, 0, scale, 0, 0)

  drawBackground(ctx, layout, theme)

  ctx.strokeStyle = theme.edge
  ctx.fillStyle = theme.edge
  ctx.lineWidth = 1.75
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  drawEdges(ctx, layout)

  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  for (const b of layout.boxes) {
    const isRoot = b.isRoot
    const swatch = theme.colors[nodeColor(b.node, isRoot)]

    // Fill with a soft drop shadow, then the border on top without one.
    ctx.save()
    ctx.shadowColor = theme.shadow
    ctx.shadowBlur = 14
    ctx.shadowOffsetY = 4
    roundRect(ctx, b)
    ctx.fillStyle = isRoot ? swatch.solid : swatch.fill
    ctx.fill()
    ctx.restore()
    if (!isRoot) {
      roundRect(ctx, b, -0.5)
      ctx.strokeStyle = swatch.border
      ctx.lineWidth = 1.25
      ctx.stroke()
    }

    if (b.node.id === selectedId) {
      roundRect(ctx, b, 4)
      ctx.strokeStyle = theme.selection
      ctx.lineWidth = 2
      ctx.setLineDash([4, 3])
      ctx.stroke()
      ctx.setLineDash([])
    }

    const lineHeight = isRoot ? ROOT_LINE_HEIGHT : LINE_HEIGHT
    ctx.font = isRoot ? ROOT_FONT : FONT
    const empty = b.lines.length === 1 && !b.lines[0]
    ctx.fillStyle = isRoot ? (empty ? "rgba(255, 255, 255, 0.6)" : "#ffffff") : empty ? theme.placeholder : theme.text
    for (const [i, line] of (empty ? ["…"] : b.lines).entries()) {
      ctx.fillText(line, b.x + b.w / 2, b.y + PAD_Y + lineHeight * (i + 0.5))
    }
  }
}

/** The step at layout point (`x`, `y`), if any. */
export function boxAt(layout: FlowLayout, x: number, y: number) {
  return layout.boxes.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)
}

/** Waits until the canvas can measure and draw with the app's font. */
export function loadFonts() {
  return Promise.all([document.fonts.load(FONT), document.fonts.load(ROOT_FONT)]).then(() => undefined)
}

export async function flowchartPng(chart: Flowchart) {
  await loadFonts()
  const canvas = document.createElement("canvas")
  drawFlow(canvas, layoutFlow(chart.root, chart.direction), chart.theme, EXPORT_SCALE)
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG konnte nicht erstellt werden"))), "image/png"),
  )
}

/** A file name from the title, e.g. "Wann informiere ich die Forensik?" → "wann-informiere-ich-die-forensik.png". */
export function pngFileName(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
  return `${slug || "ablaufdiagramm"}.png`
}
