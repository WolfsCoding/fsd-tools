import { useMemo } from "react"
import { useLocalStorage } from "@/lib/local-storage"

/** Own text snippets (Textbausteine), e.g. a Belehrung, inserted into the multi-line fields. */
export const SNIPPETS_KEY = "akten:snippets"

export interface Snippet {
  id: string
  title: string
  /** May hold `{{ME}}`, `{{DEPARTMENT}}` and `{{now:…}}`, which are filled in like anywhere else. */
  text: string
}

const NO_SNIPPETS: Snippet[] = []

/** Whether `value` (imported data) is a list of snippets; missing counts as valid. */
export function isValidSnippets(value: unknown) {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.every(
        (s) =>
          typeof s === "object" &&
          s !== null &&
          ["id", "title", "text"].every((k) => typeof (s as Record<string, unknown>)[k] === "string"),
      ))
  )
}

/** A snippet's name: its title, else the start of its text. */
export function snippetLabel(snippet: Snippet) {
  return snippet.title.trim() || snippet.text.trim().split("\n")[0].slice(0, 60) || "Unbenannter Textbaustein"
}

/** The stored snippets in their order, and everything that changes them. */
export function useSnippets() {
  const [snippets, setSnippets] = useLocalStorage<Snippet[]>(SNIPPETS_KEY, NO_SNIPPETS)
  const actions = useMemo(
    () => ({
      /** Adds an empty snippet at the end and returns its id. */
      addSnippet() {
        const id = crypto.randomUUID()
        setSnippets((prev) => [...prev, { id, title: "", text: "" }])
        return id
      },
      updateSnippet(id: string, changes: Partial<Omit<Snippet, "id">>) {
        setSnippets((prev) => prev.map((s) => (s.id === id ? { ...s, ...changes } : s)))
      },
      removeSnippet(id: string) {
        setSnippets((prev) => prev.filter((s) => s.id !== id))
      },
      /** Puts back a snippet removed with `removeSnippet` at its old position. */
      restoreSnippet(snippet: Snippet, index: number) {
        setSnippets((prev) => (prev.some((s) => s.id === snippet.id) ? prev : prev.toSpliced(index, 0, snippet)))
      },
    }),
    [setSnippets],
  )
  return { snippets, ...actions }
}
