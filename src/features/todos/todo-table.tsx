import { useState, type ReactNode } from "react"
import { FileTextIcon, PencilIcon, Trash2Icon, UserIcon } from "lucide-react"
import { Link } from "react-router"
import { toast } from "sonner"
import { cn } from "cn"
import { Hint } from "@/components/hint"
import { Checkbox } from "@/components/ui/checkbox"
import { caseFilePath } from "@/features/case-files/paths"
import { personPath } from "@/features/dna-db/paths"
import { formatDateTime, formatRelative } from "@/lib/format-date"
import { removedToast } from "@/lib/undo"
import { todoLink, useLinkOptions, type LinkOption, type TodoLink } from "./link-options"
import { TodoDialog } from "./todo-dialog"
import type { Todo } from "./types"
import type { TodosApi } from "./use-todos"

// Same box as the tables in the Akten (`BOX` in doc-form).
const BOX = "overflow-hidden rounded-lg border bg-background/50"
const TH = "h-9 px-3 text-left font-medium whitespace-nowrap"

/** Todos as a table: a checkbox to tick them off, the title, the link, when, and the actions. */
export function TodoTable({ todos, api }: { todos: Todo[]; api: TodosApi }) {
  const [editing, setEditing] = useState<Todo | undefined>()
  const options = useLinkOptions()
  const caseFiles = new Map(options.caseFiles.map((o) => [o.id, o]))
  const persons = new Map(options.persons.map((o) => [o.id, o]))

  return (
    <div className={cn(BOX, "overflow-x-auto")}>
      <table className="w-full min-w-2xl border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="bg-muted/50 text-xs text-muted-foreground *:border-b">
            <th className="h-9 w-10 pl-3" aria-label="Erledigt" />
            <th className={TH}>Todo</th>
            <th className={cn(TH, "w-[25%]")}>Link</th>
            <th className={cn(TH, "w-32")}>Erstellt</th>
            <th className="h-9 w-20 px-3" aria-label="Aktionen" />
          </tr>
        </thead>
        <tbody className="stagger-in">
          {todos.map((todo) => (
            <tr key={todo.id} className="group transition-colors hover:bg-accent/20 *:border-b last:*:border-b-0">
              <td className="py-2 pl-3 align-middle">
                <Checkbox
                  checked={todo.done}
                  onCheckedChange={() => {
                    api.toggleTodo(todo.id)
                    // Done todos usually leave the list, so say where it went and offer it back.
                    if (!todo.done)
                      toast(`Todo „${todo.title}“ erledigt`, {
                        action: { label: "Rückgängig", onClick: () => api.toggleTodo(todo.id) },
                      })
                  }}
                  aria-label={todo.done ? "Wieder öffnen" : "Als erledigt markieren"}
                />
              </td>
              <td className="max-w-0 px-3 py-2">
                <span
                  className={cn("block truncate font-medium", todo.done && "text-muted-foreground line-through")}
                >
                  {todo.title}
                </span>
              </td>
              <td className="max-w-0 px-3 py-2">
                <LinkCell link={todoLink(todo)} caseFiles={caseFiles} persons={persons} />
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                <Hint label={formatDateTime(todo.createdAt)}>
                  <span>{formatRelative(todo.createdAt)}</span>
                </Hint>
              </td>
              <td className="px-2 py-2">
                <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <Action label="Bearbeiten" onClick={() => setEditing(todo)}>
                    <PencilIcon />
                  </Action>
                  <Action
                    label="Löschen"
                    onClick={() => removedToast(`Todo „${todo.title}“`, api.deleteTodo(todo.id))}
                    className="text-red-400"
                  >
                    <Trash2Icon />
                  </Action>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <TodoDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(undefined)}
        todo={editing}
        onSubmit={(input) => editing && api.updateTodo(editing.id, input)}
      />
    </div>
  )
}

function LinkCell({
  link,
  caseFiles,
  persons,
}: {
  link?: TodoLink
  caseFiles: Map<string, LinkOption>
  persons: Map<string, LinkOption>
}) {
  const option = link && (link.kind === "caseFile" ? caseFiles : persons).get(link.id)
  if (!link || !option) return <span className="text-muted-foreground">–</span>
  return link.kind === "caseFile" ? (
    <LinkChip to={caseFilePath(link.id)} icon={FileTextIcon} label={option.label} />
  ) : (
    <LinkChip to={personPath(link.id)} icon={UserIcon} label={option.label} />
  )
}

function LinkChip({ to, icon: Icon, label }: { to: string; icon: typeof UserIcon; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-primary/10 px-2 py-0.5 text-xs text-sky-300 transition-colors hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  )
}

function Action({
  label,
  onClick,
  className,
  children,
}: {
  label: string
  onClick: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <Hint label={label}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={cn(
          "flex size-7 items-center justify-center rounded-md text-muted-foreground/80 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&_svg]:size-4",
          className,
        )}
      >
        {children}
      </button>
    </Hint>
  )
}
