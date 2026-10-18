import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { FilePlusIcon, FileTextIcon, NotebookPenIcon } from "lucide-react"
import { Explorer } from "@/components/explorer"
import { NoResults } from "@/components/no-results"
import { SearchField } from "@/components/search-field"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useRegisterCommands, type CommandGroupDef } from "@/hooks/use-command-palette"
import { NoteList } from "./note-list"
import { notePath } from "./paths"
import { noteTitle, useNotes } from "./use-notes"

/** Notes in Markdown/HTML, like the ones about a person. */
export function NotesPage() {
  const { notes, updateNotes } = useNotes()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState("")
  const [creating, setCreating] = useState(false)
  // Set by the command palette; folded open once, then taken out of the URL again.
  const reveal = params.get("note") ?? undefined

  useEffect(() => {
    if (!reveal) return
    setQuery("")
    setParams((p) => (p.delete("note"), p), { replace: true })
  }, [reveal, setParams])

  const commandGroups = useMemo<CommandGroupDef[]>(
    () => [
      {
        heading: "Notizen",
        items: [{ id: "notes:new", label: "Neue Notiz", icon: FilePlusIcon, onSelect: () => setCreating(true) }],
      },
      {
        heading: "Alle Notizen",
        actionLabel: "Notiz öffnen",
        items: notes.map((n) => ({
          id: `notes:note:${n.id}`,
          label: noteTitle(n),
          keywords: [n.content.slice(0, 500)],
          icon: FileTextIcon,
          onSelect: () => navigate(notePath(n.id)),
        })),
      },
    ],
    [notes, navigate],
  )
  useRegisterCommands("notes", commandGroups)

  const q = query.trim().toLowerCase()
  const shown = q
    ? notes.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
    : notes

  return (
    <Explorer
      title="Notizen"
      toolbar={
        notes.length > 0 && (
          <>
            <SearchField value={query} onChange={setQuery} aria-label="Notizen durchsuchen" focusKey />
            <Button onClick={() => setCreating(true)}>
              <FilePlusIcon /> Neue Notiz
            </Button>
          </>
        )
      }
    >
      <NoteList
        notes={shown}
        onUpdate={updateNotes}
        creating={creating}
        onCreatingChange={setCreating}
        reveal={reveal}
        empty={
          notes.length ? <NoResults query={query} onReset={() => setQuery("")} /> : <Home onCreate={() => setCreating(true)} />
        }
      />
    </Explorer>
  )
}

function Home({ onCreate }: { onCreate: () => void }) {
  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <NotebookPenIcon />
        </EmptyMedia>
        <EmptyTitle>Noch keine Notizen</EmptyTitle>
        <EmptyDescription>Schreib Notizen in Markdown, mit Vorschau daneben.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onCreate}>
          <FilePlusIcon /> Neue Notiz
        </Button>
      </EmptyContent>
    </Empty>
  )
}
