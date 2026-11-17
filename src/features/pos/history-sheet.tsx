import { useAtom } from "@effect/atom-react"
import { Trash2Icon } from "lucide-react"
import { EmptyList } from "@/components/no-results"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { formatDate, formatDateAndTime } from "@/lib/format-date"
import { removedToast } from "@/lib/undo"
import { guestsTotal, guestTotal, historyAtom, type ClosedOrder } from "./order"
import { Price } from "./price"

function todayTotal(history: ClosedOrder[]) {
  const today = formatDate(new Date())
  return history.filter((o) => formatDate(o.closedAt) === today).reduce((sum, o) => sum + guestsTotal(o.guests), 0)
}

/** The finished orders, newest first. */
export function HistorySheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [history, setHistory] = useAtom(historyAtom)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Verlauf</SheetTitle>
          <SheetDescription className="tabular-nums">
            {history.length.toLocaleString("de-DE")} {history.length === 1 ? "Bestellung" : "Bestellungen"} · Umsatz heute: <Price value={todayTotal(history)} />
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          {history.length === 0 && <EmptyList>Noch keine abgeschlossenen Bestellungen</EmptyList>}
          <Accordion type="single" collapsible>
            {history.map((order) => (
              <AccordionItem key={order.id} value={order.id}>
                <AccordionTrigger className="gap-3">
                  <span className="grid min-w-0 flex-1 gap-0.5 text-left">
                    <span className="truncate">{order.label || "Bestellung"}</span>
                    <span className="text-xs font-normal text-muted-foreground tabular-nums">
                      {formatDateAndTime(order.closedAt)} · {order.guests.length} {order.guests.length === 1 ? "Person" : "Personen"}
                    </span>
                  </span>
                  <Price value={guestsTotal(order.guests)} />
                </AccordionTrigger>
                <AccordionContent className="grid gap-3">
                  {order.guests.map((guest) => (
                    <div key={guest.id} className="grid gap-1">
                      <div className="flex justify-between gap-4 font-medium">
                        <span className="min-w-0 truncate">{guest.name}</span>
                        <Price value={guestTotal(guest)} />
                      </div>
                      {guest.lines.map((line) => (
                        <div key={line.id} className="grid grid-cols-[1fr_auto] gap-x-4 text-muted-foreground">
                          <span>
                            {line.qty} × {line.name}
                          </span>
                          <Price value={line.price * line.qty} />
                          {line.note.trim() && <span className="col-span-2 pl-4 text-xs italic">{line.note.trim()}</span>}
                        </div>
                      ))}
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-self-start text-muted-foreground"
                    onClick={() => {
                      const index = history.indexOf(order)
                      setHistory(history.filter((o) => o.id !== order.id))
                      removedToast("Bestellung", () => setHistory((now) => now.toSpliced(index, 0, order)))
                    }}
                  >
                    <Trash2Icon /> Löschen
                  </Button>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </SheetContent>
    </Sheet>
  )
}
