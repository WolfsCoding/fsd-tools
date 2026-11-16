import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { guestName, guestsTotal, guestTotal, type OpenOrder } from "./order"
import { Price } from "./price"

/** Bills the persons `guestIds`, i.e. the ones selected on the bill; undefined while closed. */
export function CheckoutDialog({
  order,
  guestIds,
  onClose,
  onPay,
}: {
  order: OpenOrder
  guestIds: string[] | undefined
  onClose: () => void
  onPay: (guestIds: string[]) => void
}) {
  return (
    <Dialog open={!!guestIds} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>{guestIds && <CheckoutForm order={order} guestIds={guestIds} onPay={onPay} />}</DialogContent>
    </Dialog>
  )
}

function CheckoutForm({ order, guestIds, onPay }: { order: OpenOrder; guestIds: string[]; onPay: (guestIds: string[]) => void }) {
  const [givenDraft, setGivenDraft] = useState("")

  const paying = order.guests.flatMap((guest, index) => (guestIds.includes(guest.id) ? { guest, name: guestName(guest, index) } : []))
  const everyone = order.guests.every((g) => g.paid || g.lines.length === 0 || guestIds.includes(g.id))
  const sum = guestsTotal(paying.map((p) => p.guest))
  const given = Number(givenDraft.trim().replace(",", "."))
  const hasGiven = givenDraft.trim() !== "" && Number.isFinite(given)

  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault()
        onPay(paying.map((p) => p.guest.id))
      }}
    >
      <DialogPanel>
        <DialogHeader>
          <DialogTitle>Abrechnen</DialogTitle>
          <DialogDescription>{everyone ? "Alle zahlen, die Bestellung wird abgeschlossen." : "Nur die ausgewählten Personen zahlen. Die anderen bleiben offen."}</DialogDescription>
        </DialogHeader>

        <div className="grid max-h-64 gap-2 overflow-y-auto">
          {paying.map(({ guest, name }) => (
            <div key={guest.id} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate">{name}</span>
              <Price value={guestTotal(guest)} />
            </div>
          ))}
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Zu zahlen</span>
          <Price value={sum} className="text-2xl font-semibold" />
        </div>

        <div className="grid grid-cols-2 items-end gap-4">
          <div className="grid gap-2">
            <Label htmlFor="pos-given">Gegeben</Label>
            <Input
              id="pos-given"
              value={givenDraft}
              onChange={(e) => setGivenDraft(e.target.value)}
              inputMode="decimal"
              placeholder="optional"
              className="font-mono"
              autoFocus
            />
          </div>
          {hasGiven && (
            <div className="grid justify-items-end gap-1">
              <span className="text-xs text-muted-foreground">{given >= sum ? "Rückgeld" : "Fehlt noch"}</span>
              <Price value={Math.abs(given - sum)} className="text-base font-medium" />
            </div>
          )}
        </div>
      </DialogPanel>
      <DialogFooter>
        <Button type="submit">Bezahlt</Button>
      </DialogFooter>
    </form>
  )
}
