import { Button } from "@/components/ui/button"

/** "Keine Treffer" line for side-panel lists, with a button that clears the search. */
export function NoResults({ query, onReset }: { query: string; onReset: () => void }) {
  return (
    <div className="grid justify-items-center gap-2 px-2.5 py-6 text-center text-sm text-muted-foreground">
      <p>Keine Treffer für „{query.trim()}"</p>
      <Button variant="ghost" size="sm" onClick={onReset}>
        Suche zurücksetzen
      </Button>
    </div>
  )
}

/** Hint shown in an empty side-panel list, e.g. "Noch keine Notizen". */
export function EmptyList({ children }: { children: React.ReactNode }) {
  return <p className="px-2.5 py-6 text-center text-sm text-balance text-muted-foreground">{children}</p>
}
