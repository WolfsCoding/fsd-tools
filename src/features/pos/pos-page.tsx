import { useState } from "react"
import { useAtom, useAtomValue } from "@effect/atom-react"
import { CheckIcon, HistoryIcon, MinusIcon, PlusIcon, Trash2Icon, UserPlusIcon, UtensilsIcon, XIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { Hint } from "@/components/hint"
import { NoResults } from "@/components/no-results"
import { SearchField } from "@/components/search-field"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { removedToast } from "@/lib/undo"
import { CatalogDialog } from "./catalog-dialog"
import { CheckoutDialog } from "./checkout-dialog"
import { HistorySheet } from "./history-sheet"
import {
  addEntry,
  catalogAtom,
  EMPTY_ORDER,
  guestName,
  guestsTotal,
  guestTotal,
  historyAtom,
  menuEntry,
  newGuest,
  orderAtom,
  patchLine,
  productEntry,
  settle,
  type Entry,
  type Guest,
  type Line,
} from "./order"
import { Price } from "./price"

/**
 * A restaurant terminal. The page is always the running order: tiles on the left add to
 * the selected person on the right. The history only opens from its button.
 */
export function PosPage() {
  const catalog = useAtomValue(catalogAtom)
  const [order, setOrder] = useAtom(orderAtom)
  const [, setHistory] = useAtom(historyAtom)
  /** The clicked persons, the last clicked at the end. */
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [query, setQuery] = useState("")
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  /** The guests the open checkout bills; undefined while it is closed. */
  const [checkout, setCheckout] = useState<string[]>()

  const open = order.guests.filter((g) => !g.paid)
  /** The person the tiles add to: the one clicked last, else the newest. */
  const active = selectedIds.flatMap((id) => open.find((g) => g.id === id) ?? []).at(-1) ?? open.at(-1)
  /** The selected persons; someone always is, so the tiles and the pay button have a target. */
  const chosen = open.filter((g) => selectedIds.includes(g.id) || g === active)
  const payable = chosen.filter((g) => g.lines.length > 0)
  const chosenNames = order.guests.flatMap((g, i) => (chosen.includes(g) ? guestName(g, i) : []))

  /** A plain click selects one person; with Shift (or Ctrl) it adds or removes one. */
  function select(guestId: string, extend: boolean) {
    if (!extend) return setSelectedIds([guestId])
    const ids = chosen.map((g) => g.id)
    const next = ids.includes(guestId) ? ids.filter((id) => id !== guestId) : [...ids, guestId]
    if (next.length > 0) setSelectedIds(next)
  }

  const needle = query.trim().toLowerCase()
  const matches = (name: string) => name.trim() !== "" && name.toLowerCase().includes(needle)
  const menus = catalog.menus.filter((m) => matches(m.name))
  const products = catalog.products.filter((p) => matches(p.name))
  const emptyCatalog = !catalog.menus.some((m) => m.name.trim()) && !catalog.products.some((p) => p.name.trim())

  /** Adds to the selected person; the first tap of an order starts with "Person 1". */
  function add(entry: Entry) {
    const guest = active ?? newGuest()
    setOrder(addEntry(active ? order : { ...order, guests: [...order.guests, guest] }, guest.id, entry))
  }

  function addGuest() {
    const guest = newGuest()
    setOrder({ ...order, guests: [...order.guests, guest] })
    setSelectedIds([guest.id])
  }

  // Every undo puts back only what its action took, so what was entered since stays.

  /** Brings a discarded or closed order back, in front of the persons added since. */
  const restoreOrder = () => setOrder((now) => ({ label: order.label || now.label, guests: [...order.guests, ...now.guests] }))

  function removeGuest(guest: Guest, index: number) {
    setOrder({ ...order, guests: order.guests.filter((g) => g.id !== guest.id) })
    if (guest.lines.length > 0) {
      removedToast(guestName(guest, index), () => setOrder((now) => ({ ...now, guests: now.guests.toSpliced(index, 0, guest) })))
    }
  }

  function changeLine(guest: Guest, line: Line, patch: Partial<Pick<Line, "qty" | "note">>) {
    setOrder(patchLine(order, guest.id, line.id, patch))
    if ((patch.qty ?? line.qty) >= 1) return
    const index = guest.lines.indexOf(line)
    removedToast(`„${line.name}“`, () =>
      setOrder((now) => ({ ...now, guests: now.guests.map((g) => (g.id === guest.id ? { ...g, lines: g.lines.toSpliced(index, 0, line) } : g)) })),
    )
  }

  function discard() {
    setOrder(EMPTY_ORDER)
    removedToast("Bestellung", restoreOrder)
  }

  function pay(guestIds: string[]) {
    const { order: next, closed } = settle(order, guestIds)
    setOrder(next)
    if (closed) setHistory((prev) => [closed, ...prev])
    setCheckout(undefined)
    toast(closed ? "Bestellung abgeschlossen" : "Als bezahlt markiert", {
      action: {
        label: "Rückgängig",
        onClick: () => {
          if (closed) {
            restoreOrder()
            setHistory((prev) => prev.filter((o) => o.id !== closed.id))
          } else {
            setOrder((now) => ({ ...now, guests: now.guests.map((g) => (guestIds.includes(g.id) ? { ...g, paid: false } : g)) }))
          }
        },
      },
    })
  }

  return (
    <div className="@container flex min-h-0 flex-1">
      {/* The bill sits on the left: toasts come up bottom right and would cover its pay button. */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 @3xl:flex-row-reverse @3xl:overflow-hidden">
        <section aria-label="Sortiment" className="flex min-w-0 flex-1 flex-col gap-3 @3xl:min-h-0">
          <div className="flex items-center gap-2">
            <SearchField value={query} onChange={setQuery} aria-label="Sortiment durchsuchen" focusKey />
            <Button variant="outline" onClick={() => setCatalogOpen(true)}>
              <UtensilsIcon /> Sortiment
            </Button>
            <Button variant="outline" onClick={() => setHistoryOpen(true)}>
              <HistoryIcon /> Verlauf
            </Button>
          </div>

          {emptyCatalog ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UtensilsIcon />
                </EmptyMedia>
                <EmptyTitle>Noch kein Sortiment</EmptyTitle>
                <EmptyDescription>Leg Artikel mit Preisen an und stell daraus Menüs zusammen. Danach tippst du sie hier an.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => setCatalogOpen(true)}>
                  <PlusIcon /> Sortiment anlegen
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="grid content-start gap-4 @3xl:min-h-0 @3xl:overflow-y-auto">
              {menus.length > 0 && (
                <Tiles title="Menüs">
                  {menus.map((menu) => {
                    const entry = menuEntry(menu, catalog.products)
                    return <Tile key={menu.id} name={menu.name} price={menu.price} detail={entry.parts?.join(", ")} onClick={() => add(entry)} />
                  })}
                </Tiles>
              )}
              {products.length > 0 && (
                <Tiles title="Artikel">
                  {products.map((product) => (
                    <Tile key={product.id} name={product.name} price={product.price} onClick={() => add(productEntry(product))} />
                  ))}
                </Tiles>
              )}
              {menus.length === 0 && products.length === 0 && <NoResults query={query} onReset={() => setQuery("")} />}
            </div>
          )}
        </section>

        <Card className="shrink-0 gap-0 py-0 @3xl:min-h-0 @3xl:w-[26rem] @5xl:w-[30rem]">
          <CardHeader className="flex items-center gap-2 border-b py-3">
            <Input
              value={order.label}
              onChange={(e) => setOrder({ ...order, label: e.target.value })}
              placeholder="Tisch oder Name der Bestellung"
              aria-label="Tisch oder Name der Bestellung"
            />
            <Hint label="Bestellung verwerfen">
              <Button variant="ghost" size="icon" onClick={discard} disabled={order.guests.length === 0 && !order.label} aria-label="Bestellung verwerfen">
                <Trash2Icon />
              </Button>
            </Hint>
          </CardHeader>

          <CardContent className="grid content-start gap-2 py-3 @3xl:min-h-0 @3xl:flex-1 @3xl:overflow-y-auto">
            {order.guests.length === 0 && (
              <p className="py-8 text-center text-sm text-balance text-muted-foreground">
                Tipp einen Artikel an, um die Bestellung zu beginnen. Er landet bei Person 1.
              </p>
            )}
            {order.guests.map((guest, index) => (
              <GuestCard
                key={guest.id}
                guest={guest}
                name={guestName(guest, index)}
                selected={chosen.includes(guest)}
                onSelect={(extend) => select(guest.id, extend)}
                onLine={(line, patch) => changeLine(guest, line, patch)}
                onRemove={() => removeGuest(guest, index)}
              />
            ))}
            {/* Stays in view at the end of a long order instead of ending up half under the total. */}
            <div className="flex items-center gap-2 bg-card @3xl:sticky @3xl:-bottom-3 @3xl:-mb-3 @3xl:pt-1 @3xl:pb-3">
              <Button variant="outline" size="sm" onClick={addGuest} aria-label="Person hinzufügen">
                <UserPlusIcon /> Person
              </Button>
              {chosen.length < open.length && (
                <Button variant="outline" size="sm" onClick={() => setSelectedIds(open.map((g) => g.id))}>
                  Alle auswählen
                </Button>
              )}
            </div>
          </CardContent>

          <CardFooter className="grid gap-3 border-t py-3">
            <div className="flex items-center justify-between gap-4">
              <span className="min-w-0 truncate text-sm text-muted-foreground">
                {chosen.length < open.length ? chosenNames.join(", ") : order.guests.some((g) => g.paid) ? "Noch offen" : "Gesamt"}
              </span>
              <Price value={guestsTotal(chosen)} className="text-2xl font-semibold" />
            </div>
            <Button size="lg" disabled={payable.length === 0} onClick={() => setCheckout(payable.map((g) => g.id))}>
              Abrechnen
            </Button>
          </CardFooter>
        </Card>
      </div>

      <CatalogDialog open={catalogOpen} onOpenChange={setCatalogOpen} />
      <HistorySheet open={historyOpen} onOpenChange={setHistoryOpen} />
      <CheckoutDialog order={order} guestIds={checkout} onClose={() => setCheckout(undefined)} onPay={pay} />
    </div>
  )
}

function Tiles({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <h2 className="text-xs font-medium text-muted-foreground">{title}</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2">{children}</div>
    </div>
  )
}

function Tile({ name, price, detail, onClick }: { name: string; price: number; detail?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-20 flex-col gap-1 rounded-lg border bg-card p-3 text-left outline-none transition-colors select-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px"
    >
      <span className="line-clamp-2 text-sm font-medium hyphens-auto">{name.trim()}</span>
      {detail && <span className="line-clamp-2 text-xs text-muted-foreground hyphens-auto">{detail}</span>}
      <Price value={price} className="mt-auto self-start text-sm text-muted-foreground" />
    </button>
  )
}

function GuestCard({
  guest,
  name,
  selected,
  onSelect,
  onLine,
  onRemove,
}: {
  guest: Guest
  name: string
  selected: boolean
  /** `extend` adds the person to the selection, or takes it out, instead of selecting only it. */
  onSelect: (extend: boolean) => void
  onLine: (line: Line, patch: Partial<Pick<Line, "qty" | "note">>) => void
  onRemove: () => void
}) {
  if (guest.paid) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
        <CheckIcon className="size-4" />
        <span className="min-w-0 flex-1 truncate">{name}</span>
        <Badge variant="secondary">Bezahlt</Badge>
        <Price value={guestTotal(guest)} />
      </div>
    )
  }

  return (
    // Clicking anywhere in a person selects it: the tiles add to it and the pay button bills it.
    <div
      onClick={(e) => onSelect(e.shiftKey || e.ctrlKey || e.metaKey)}
      // A Shift click would also mark the text in between.
      onMouseDown={(e) => e.shiftKey && e.preventDefault()}
      aria-current={selected || undefined}
      className={cn("grid gap-2 rounded-lg border p-2 transition-colors", selected ? "border-selection-border bg-selection" : "hover:bg-accent/40")}
    >
      <div className="flex items-center gap-1">
        {/* The keyboard's way to select the person; the pointer has the whole card. */}
        <button
          type="button"
          aria-pressed={selected}
          onClick={(e) => {
            e.stopPropagation()
            onSelect(e.shiftKey || e.ctrlKey || e.metaKey)
          }}
          className="min-w-0 flex-1 truncate rounded-sm px-1.5 text-left text-sm font-medium outline-none select-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {name}
        </button>
        <Price value={guestTotal(guest)} className="text-sm" />
        <Hint label={`${name} entfernen`}>
          <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label={`${name} entfernen`}>
            <XIcon />
          </Button>
        </Hint>
      </div>

      {guest.lines.length === 0 && selected && <p className="px-1.5 pb-1 text-xs text-muted-foreground">Artikel antippen, um sie hier hinzuzufügen.</p>}

      {guest.lines.map((line) => (
        <div key={line.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1 rounded-md bg-background/60 p-1.5">
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onLine(line, { qty: line.qty - 1 })}
              aria-label={line.qty > 1 ? `Ein ${line.name} weniger` : `${line.name} entfernen`}
            >
              {line.qty > 1 ? <MinusIcon /> : <Trash2Icon />}
            </Button>
            <span className="w-5 text-center font-mono text-sm">{line.qty}</span>
            <Button variant="ghost" size="icon-xs" onClick={() => onLine(line, { qty: line.qty + 1 })} aria-label={`Ein ${line.name} mehr`}>
              <PlusIcon />
            </Button>
          </div>
          <span className="min-w-0 truncate text-sm">{line.name}</span>
          <Price value={line.price * line.qty} className="text-sm" />
          {line.parts && line.parts.length > 0 && <span className="col-start-2 col-end-4 text-xs text-muted-foreground">{line.parts.join(", ")}</span>}
          <input
            value={line.note}
            onChange={(e) => onLine(line, { note: e.target.value })}
            placeholder="Notiz, z. B. ohne Zwiebeln"
            aria-label={`Notiz zu ${line.name}`}
            className="col-start-2 col-end-4 h-6 min-w-0 rounded-sm bg-transparent text-xs outline-none placeholder:text-muted-foreground/70 focus-visible:bg-background focus-visible:px-1 focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      ))}
    </div>
  )
}
