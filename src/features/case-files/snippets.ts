import { useAtom } from "@effect/atom-react"
import * as Schema from "effect/Schema"
import { useMemo } from "react"
import { stored, type StoredValue } from "@/lib/storage"

/** Own text snippets (Textbausteine), e.g. a Belehrung, inserted into the multi-line fields. */
export const SNIPPETS_KEY = "akten:snippets"

export const Snippet = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  /** May hold `{{ME}}`, `{{DEPARTMENT}}` and `{{now:…}}`, which are filled in like anywhere else. */
  text: Schema.String,
})
export type Snippet = StoredValue<typeof Snippet>

const NO_SNIPPETS: Snippet[] = []

export const snippetsAtom = stored(SNIPPETS_KEY, Schema.Array(Snippet), NO_SNIPPETS)

/** A stored list of snippets, e.g. the own Textbausteine or the templates of an analysis. */
export type SnippetsAtom = typeof snippetsAtom

/** A snippet's name: its title, else the start of its text. */
export function snippetLabel(snippet: Snippet) {
  return snippet.title.trim() || snippet.text.trim().split("\n")[0].slice(0, 60) || "Unbenannter Textbaustein"
}

/** The snippets of `atom` (the own Textbausteine by default) in their order, and everything that changes them. */
export function useSnippets(atom: SnippetsAtom = snippetsAtom) {
  const [snippets, setSnippets] = useAtom(atom)
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
