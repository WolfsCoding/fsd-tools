import { useMemo, useState } from "react"
import { useLinkOptions } from "./link-options"
import { TodoPanel } from "./todo-panel"
import { useTodos } from "./use-todos"

/** All todos, searchable by their text and the names of what they link. */
export function TodosPage() {
  const api = useTodos()
  const options = useLinkOptions()
  const [query, setQuery] = useState("")

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return api.todos
    const labels = new Map([...options.caseFiles, ...options.persons].map((o) => [o.id, `${o.label} ${o.hint ?? ""}`]))
    return api.todos.filter((t) => {
      const links = [...(t.caseFileIds ?? []), ...(t.personIds ?? [])].map((id) => labels.get(id) ?? "")
      return [t.title, t.author ?? "", ...links].some((text) => text.toLowerCase().includes(q))
    })
  }, [api.todos, options, query])

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      <TodoPanel
        todos={shown}
        api={api}
        empty={query.trim() ? `Keine Todos für „${query.trim()}“.` : "Noch keine Todos."}
        search={{ query, onQuery: setQuery }}
      />
    </main>
  )
}
