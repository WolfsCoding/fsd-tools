import type { Operation, Task } from "./types"
import { TaskRow } from "./task-row"
import { sortTasks, type useOperations } from "./use-operations"

type Api = ReturnType<typeof useOperations>

/** Tasks as cards of their own, the most urgent first; each row can show its details. */
export function TaskList({ operation, tasks, api }: { operation: Operation; tasks: Task[]; api: Api }) {
  return (
    <ul className="grid gap-2 *:animate-item-in">
      {sortTasks(tasks).map((t) => (
        <TaskRow key={t.id} operation={operation} task={t} api={api} detailed />
      ))}
    </ul>
  )
}
