import { RotateCcwIcon } from "lucide-react"
import { BackButton } from "@/components/explorer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChargesEditor } from "@/features/case-files/charges-input"
import type { Row } from "@/features/case-files/types"
import { useTabTitle } from "@/hooks/use-tabs"
import { useLocalStorage } from "@/lib/local-storage"
import { removedToast } from "@/lib/undo"
import { LAW_BOOK_BASE } from "./paths"

/** The calculator's charges, as rows like the ones of a case file. */
export const CALCULATOR_KEY = "gesetzbuch:rechner"

const NO_ROWS: unknown = []

const rowsOf = (value: unknown): Row[] => (Array.isArray(value) ? value : [])

/** The Strafrechner: offenses added up like in a case file, without one. Kept until reset. */
export function ChargeCalculator() {
  useTabTitle("Strafrechner")
  const [stored, setStored] = useLocalStorage(CALCULATOR_KEY, NO_ROWS)
  const rows = rowsOf(stored)

  const reset = () => {
    const removed = rows
    setStored([])
    // Rows added since come after the restored ones.
    removedToast("Rechnung", () =>
      setStored((prev: unknown) => {
        const now = rowsOf(prev)
        return [...removed.filter((r) => !now.some((n) => n.id === r.id)), ...now]
      }),
    )
  }

  return (
    <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid max-w-5xl gap-6 px-6 py-8">
        <header className="flex flex-wrap items-end gap-4 border-b pb-6">
          <div className="grid flex-1 gap-2">
            <div className="flex items-center gap-2">
              <BackButton to={LAW_BOOK_BASE} label="Alle Gesetzbücher" className="-ml-2" />
              <Badge variant="secondary" className="w-fit">
                CO · TO
              </Badge>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Strafrechner</h1>
            <p className="text-sm text-muted-foreground">
              Straftaten zusammenrechnen, ohne eine Akte anzulegen. Die Rechnung bleibt gespeichert, bis sie zurückgesetzt
              wird.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={reset} disabled={rows.length === 0}>
            <RotateCcwIcon />
            Zurücksetzen
          </Button>
        </header>
        <ChargesEditor label="Straftaten" value={rows} onChange={setStored} />
      </div>
    </main>
  )
}
