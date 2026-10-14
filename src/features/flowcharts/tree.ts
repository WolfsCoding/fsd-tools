import type { FlowNode } from "./types"

export const newNode = (text = ""): FlowNode => ({ id: crypto.randomUUID(), text, children: [] })

/** Every node with its depth and parent, in reading order. */
export function flatten(root: FlowNode) {
  const out: { node: FlowNode; depth: number; parent: FlowNode | undefined }[] = []
  const visit = (node: FlowNode, depth: number, parent: FlowNode | undefined) => {
    out.push({ node, depth, parent })
    for (const child of node.children) visit(child, depth + 1, node)
  }
  visit(root, 0, undefined)
  return out
}

/** Number of steps; links to other steps don't count. */
export function countNodes(root: FlowNode): number {
  return (root.linkTo === undefined ? 1 : 0) + root.children.reduce((sum, c) => sum + countNodes(c), 0)
}

export const newLink = (target: string): FlowNode => ({ id: crypto.randomUUID(), text: "", children: [], linkTo: target })

/** Every step by id; links are left out. */
export function stepsById(root: FlowNode) {
  return new Map(flatten(root).flatMap(({ node }) => (node.linkTo === undefined ? [[node.id, node] as const] : [])))
}

/** The steps that come right after `node`: its own steps and the ones its links lead to. */
export function nextSteps(node: FlowNode, steps: Map<string, FlowNode>) {
  return node.children.flatMap((c) => {
    if (c.linkTo === undefined) return [c]
    const target = steps.get(c.linkTo)
    return target ? [target] : []
  })
}

/**
 * Steps a link from `sourceId` may lead to: not the step itself, not one it already leads
 * to, and none that leads back to it, so the chart never runs in a circle.
 */
export function linkTargets(root: FlowNode, sourceId: string) {
  const steps = stepsById(root)
  const source = steps.get(sourceId)
  if (!source) return []
  const direct = new Set(nextSteps(source, steps).map((s) => s.id))
  // Whether `sourceId` can be reached from `from`.
  const memo = new Map<string, boolean>()
  const reaches = (from: FlowNode): boolean => {
    if (from.id === sourceId) return true
    const known = memo.get(from.id)
    if (known !== undefined) return known
    memo.set(from.id, false)
    const result = nextSteps(from, steps).some(reaches)
    memo.set(from.id, result)
    return result
  }
  return [...steps.values()].filter((s) => !direct.has(s.id) && !reaches(s))
}

/** The parent of `id` and its index there; undefined for the root or a missing id. */
export function findParent(root: FlowNode, id: string): { parent: FlowNode; index: number } | undefined {
  for (const [index, child] of root.children.entries()) {
    if (child.id === id) return { parent: root, index }
    const found = findParent(child, id)
    if (found) return found
  }
}

/** Replaces node `id` with what `fn` returns; untouched branches keep their identity. */
export function mapNode(root: FlowNode, id: string, fn: (node: FlowNode) => FlowNode): FlowNode {
  if (root.id === id) return fn(root)
  let changed = false
  const children = root.children.map((c) => {
    const next = mapNode(c, id, fn)
    if (next !== c) changed = true
    return next
  })
  return changed ? { ...root, children } : root
}

/** Inserts `node` as child `index` of `parentId`; past the end it is appended. */
export function insertChild(root: FlowNode, parentId: string, node: FlowNode, index = Infinity) {
  return mapNode(root, parentId, (p) => {
    const children = [...p.children]
    children.splice(Math.min(index, children.length), 0, node)
    return { ...p, children }
  })
}

export function removeNode(root: FlowNode, id: string) {
  const at = findParent(root, id)
  if (!at) return root
  return mapNode(root, at.parent.id, (p) => ({ ...p, children: p.children.filter((c) => c.id !== id) }))
}

/** Moves `id` by `delta` places among its siblings. */
export function moveNode(root: FlowNode, id: string, delta: number) {
  const at = findParent(root, id)
  if (!at) return root
  const to = at.index + delta
  if (to < 0 || to >= at.parent.children.length) return root
  return mapNode(root, at.parent.id, (p) => {
    const children = [...p.children]
    const [node] = children.splice(at.index, 1)
    children.splice(to, 0, node)
    return { ...p, children }
  })
}
