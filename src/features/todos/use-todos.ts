import { useCallback } from "react"
import { useOwnIdentity } from "@/features/case-files/use-case-files"
import { useLocalStorage } from "@/lib/local-storage"
import type { Todo, TodoInput } from "./types"

export const TODOS_KEY = "todos:todos"
const NO_TODOS: Todo[] = []

const isIds = (value: unknown) => value === undefined || (Array.isArray(value) && value.every((v) => typeof v === "string"))
const isText = (value: unknown) => value === undefined || typeof value === "string"

/** Checks imported data before it replaces the stored todos. */
export function isValidTodosData(data: Record<string, unknown>) {
  const todos = data[TODOS_KEY]
  return todos === undefined || (Array.isArray(todos) && todos.every(isTodo))
}

function isTodo(value: unknown): value is Todo {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return (
    ["id", "title", "createdAt"].every((k) => typeof v[k] === "string") &&
    typeof v.done === "boolean" &&
    isIds(v.caseFileIds) &&
    isIds(v.personIds) &&
    isText(v.note) &&
    isText(v.author) &&
    isText(v.doneAt)
  )
}

/** Leaves out empty lists, so stored todos stay small. */
function clean(input: Partial<TodoInput>): Partial<Todo> {
  return {
    ...input,
    ...("caseFileIds" in input && { caseFileIds: input.caseFileIds?.length ? input.caseFileIds : undefined }),
    ...("personIds" in input && { personIds: input.personIds?.length ? input.personIds : undefined }),
  }
}

export function useTodos() {
  const [todos, setTodos] = useLocalStorage<Todo[]>(TODOS_KEY, NO_TODOS)
  const { identity } = useOwnIdentity()

  const addTodo = useCallback(
    (input: TodoInput) => {
      const todo: Todo = {
        id: crypto.randomUUID(),
        done: false,
        ...(identity.full ? { author: identity.full } : {}),
        createdAt: new Date().toISOString(),
        ...clean(input),
        title: input.title,
      }
      setTodos((prev) => [...prev, todo])
    },
    [identity.full, setTodos],
  )

  const updateTodo = useCallback(
    (id: string, input: Partial<TodoInput>) =>
      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, ...clean(input) } : t))),
    [setTodos],
  )

  const toggleTodo = useCallback(
    (id: string) =>
      setTodos((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, done: !t.done, doneAt: t.done ? undefined : new Date().toISOString() } : t,
        ),
      ),
    [setTodos],
  )

  /** Deletes the todo; the returned function puts it back where it was. */
  const deleteTodo = useCallback(
    (id: string) => {
      const index = todos.findIndex((t) => t.id === id)
      const todo = todos[index]
      setTodos((prev) => prev.filter((t) => t.id !== id))
      return () =>
        setTodos((prev) =>
          !todo || prev.some((t) => t.id === id) ? prev : [...prev.slice(0, index), todo, ...prev.slice(index)],
        )
    },
    [todos, setTodos],
  )

  return { todos, addTodo, updateTodo, toggleTodo, deleteTodo }
}

export type TodosApi = ReturnType<typeof useTodos>
