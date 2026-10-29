import { useMemo, useState } from "react"
import { CarIcon, PlusIcon } from "lucide-react"
import { NoResults } from "@/components/no-results"
import { SearchField } from "@/components/search-field"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { DATE_FILTERS, filterChecks, STATUS_FILTERS, type DateFilter, type StatusFilter } from "./filter"
import { PlateTable } from "./plate-table"
import { usePlates } from "./use-plates"

/** All plate checks in the order they were added, searchable and filtered by status and date. */
export function PlatesPage() {
  const api = usePlates()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>("alle")
  const [date, setDate] = useState<DateFilter>("alle")

  const shown = useMemo(() => filterChecks(api.checks, { query, status, date }), [api.checks, query, status, date])
  const keep = (e: Event) => e.preventDefault()
  const resetFilters = () => {
    setQuery("")
    setStatus("alle")
    setDate("alle")
  }

  if (api.checks.length === 0) {
    return (
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CarIcon />
            </EmptyMedia>
            <EmptyTitle>Noch keine Abfragen</EmptyTitle>
            <EmptyDescription>
              Trag gesehene Kennzeichen mit Fahrer, Fahrzeug, Datum und Tatort ein. Nicht angemeldete kopierst du als Ticket.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              onClick={() => {
                api.addCheck()
                requestAnimationFrame(() => document.querySelector<HTMLElement>("main tbody input")?.focus())
              }}
            >
              <PlusIcon /> Abfrage hinzufügen
            </Button>
          </EmptyContent>
        </Empty>
      </main>
    )
  }

  return (
    <main className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="grid gap-3">
        <SearchField
          value={query}
          onChange={setQuery}
          aria-label="Abfragen durchsuchen"
          focusKey
          filtered={status !== "alle" || date !== "alle"}
          filters={
            <>
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                {STATUS_FILTERS.map((s) => (
                  <DropdownMenuRadioItem key={s.value} value={s.value} onSelect={keep}>
                    {s.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Datum</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={date} onValueChange={(v) => setDate(v as DateFilter)}>
                {DATE_FILTERS.map((d) => (
                  <DropdownMenuRadioItem key={d.value} value={d.value} onSelect={keep}>
                    {d.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </>
          }
        />
        <PlateTable
          checks={shown}
          api={api}
          onAdd={() => {
            // A new row must not be hidden by the search or a filter.
            resetFilters()
            api.addCheck()
          }}
        />
        {query.trim() && !shown.length && <NoResults query={query} onReset={resetFilters} />}
      </div>
    </main>
  )
}
