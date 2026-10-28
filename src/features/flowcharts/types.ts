import * as Schema from "effect/Schema"
import type { StoredValue } from "@/lib/storage"

export const NODE_COLORS = ["default", "blue", "green", "amber", "red", "purple"] as const
export type NodeColor = (typeof NODE_COLORS)[number]

/** One step of a flowchart. More than one child splits the path. */
export interface FlowNode {
  id: string
  text: string
  /** Missing means the default look: blue for the first step, grey for the rest. */
  color?: NodeColor
  children: FlowNode[]
  /**
   * Makes this node a link instead of a step: its parent leads on to the step with this id,
   * so several paths can end in the same step. Links have no text or children of their own.
   */
  linkTo?: string
}

/** `FlowNode` as the schema sees it; the recursion needs the type spelled out. */
interface StoredFlowNode {
  readonly id: string
  readonly text: string
  readonly color?: NodeColor
  readonly children: readonly StoredFlowNode[]
  readonly linkTo?: string
}

export const FlowNode = Schema.Struct({
  id: Schema.String,
  text: Schema.String,
  color: Schema.optionalKey(Schema.Literals(NODE_COLORS)),
  children: Schema.Array(Schema.suspend((): Schema.Codec<StoredFlowNode> => FlowNode)),
  linkTo: Schema.optionalKey(Schema.String),
})

export const FLOW_DIRECTIONS = ["down", "right"] as const
export type FlowDirection = (typeof FLOW_DIRECTIONS)[number]
export const FLOW_THEMES = ["dark", "light"] as const
export type FlowTheme = (typeof FLOW_THEMES)[number]

export const Flowchart = Schema.Struct({
  id: Schema.String,
  /** The first step; its text is the flowchart's title. */
  root: FlowNode,
  direction: Schema.Literals(FLOW_DIRECTIONS),
  theme: Schema.Literals(FLOW_THEMES),
  createdAt: Schema.String,
  updatedAt: Schema.String,
})
export type Flowchart = StoredValue<typeof Flowchart>
