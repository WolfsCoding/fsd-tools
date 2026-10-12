/** Route prefix of the operations; must match its `path` in the registry. */
export const OPERATIONS_BASE = "/operations"

export function operationPath(id: string) {
  return `${OPERATIONS_BASE}/${id}`
}
