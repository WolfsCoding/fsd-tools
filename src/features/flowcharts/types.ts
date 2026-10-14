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

export type FlowDirection = "down" | "right"
export type FlowTheme = "dark" | "light"

export interface Flowchart {
  id: string
  /** The first step; its text is the flowchart's title. */
  root: FlowNode
  direction: FlowDirection
  theme: FlowTheme
  createdAt: string
  updatedAt: string
}
