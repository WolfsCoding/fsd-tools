import { useMemo, useState } from "react"
import { ListTodoIcon, PlusIcon } from "lucide-react"
import { EmptyList } from "@/components/no-results"
import { FilterMenu, SearchField } from "@/components/search-field"
import { Button } from "@/components/ui/button"
import { DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu"
import { useRegisterCommands, type CommandGroupDef } from "@/hooks/use-command-palette"
import { TodoDialog } from "./todo-dialog"
import { TodoTable } from "./todo-table"
import type { Todo, TodoInput } from "./types"
import type { TodosApi } from "./use-todos"

/**
 * Todos with the toolbar to filter and create them; open ones first, newest on top.
 * `preset` links new todos, e.g. to the person whose page shows them.
 */
export function TodoPanel({
  todos,
  api,
  preset,
  search,
  empty = "Noch keine Todos.",
}: {
  todos: Todo[]
  api: TodosApi
  preset?: Partial<TodoInput>
  /** Shows a search field (with the filter in it) at the start of the toolbar. */
  search?: { query: string; onQuery: (query: string) => void }
  empty?: string
}) {
  const [showDone, setShowDone] = useState(false)
  const [creating, setCreating] = useState(false)
  // Only the Todos page (the one with the search) offers its commands; a person's todos don't.
  const onPage = !!search
  const commandGroups = useMemo<CommandGroupDef[]>(
    () =>
      onPage
        ? [
            {
              heading: "Todos",
              items: [{ id: "todos:new", label: "Neues Todo", icon: PlusIcon, onSelect: () => setCreating(true) }],
            },
          ]
        : [],
    [onPage],
  )
  useRegisterCommands("todos", commandGroups)
  const done = todos.filter((t) => t.done)
  const shown = todos
    .filter((t) => showDone || !t.done)
    .sort((a, b) => Number(a.done) - Number(b.done) || b.createdAt.localeCompare(a.createdAt))
  const filters = (
    <DropdownMenuCheckboxItem checked={showDone} onCheckedChange={setShowDone} onSelect={(e) => e.preventDefault()}>
      Erledigte anzeigen
      {done.length > 0 && <span className="ml-auto text-muted-foreground">{done.length}</span>}
    </DropdownMenuCheckboxItem>
  )

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        {search ? (
          <SearchField
            value={search.query}
            onChange={search.onQuery}
            aria-label="Todos durchsuchen"
            focusKey
            filtered={showDone}
            filters={filters}
          />
        ) : (
          <FilterMenu filtered={showDone}>{filters}</FilterMenu>
        )}
        <Button className="ml-auto" onClick={() => setCreating(true)}>
          <PlusIcon /> Neues Todo
        </Button>
      </div>

      {shown.length ? (
        <TodoTable todos={shown} api={api} />
      ) : (
        <div className="grid justify-items-center rounded-lg border border-dashed py-4">
          <ListTodoIcon className="size-5 text-muted-foreground" />
          <EmptyList>{todos.length ? "Alle Todos erledigt." : empty}</EmptyList>
        </div>
      )}

      <TodoDialog open={creating} onOpenChange={setCreating} preset={preset} onSubmit={api.addTodo} />
    </div>
  )
}
