import * as Schema from "effect/Schema"
import { stored, type StoredValue } from "@/lib/storage"

export const Product = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  price: Schema.Number,
})
export type Product = StoredValue<typeof Product>

/** Several products sold together for one price. */
export const Menu = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  price: Schema.Number,
  productIds: Schema.Array(Schema.String),
})
export type Menu = StoredValue<typeof Menu>

export const Catalog = Schema.Struct({
  products: Schema.Array(Product),
  menus: Schema.Array(Menu),
})
export type Catalog = StoredValue<typeof Catalog>

/** Name and price are copied from the catalog, so the history survives changes to it. */
export const Line = Schema.Struct({
  id: Schema.String,
  /** The id of the product or menu it was added from. */
  ref: Schema.String,
  name: Schema.String,
  price: Schema.Number,
  qty: Schema.Number,
  note: Schema.String,
  /** What a menu contains. */
  parts: Schema.optionalKey(Schema.Array(Schema.String)),
})
export type Line = StoredValue<typeof Line>

export const Guest = Schema.Struct({
  id: Schema.String,
  /** Empty on a running order, where persons show as "Person 1", "Person 2", …; fixed once it is closed. */
  name: Schema.String,
  lines: Schema.Array(Line),
  paid: Schema.Boolean,
})
export type Guest = StoredValue<typeof Guest>

export const OpenOrder = Schema.Struct({
  label: Schema.String,
  guests: Schema.Array(Guest),
})
export type OpenOrder = StoredValue<typeof OpenOrder>

export const ClosedOrder = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  guests: Schema.Array(Guest),
  closedAt: Schema.String,
})
export type ClosedOrder = StoredValue<typeof ClosedOrder>

const EMPTY_CATALOG: Catalog = { products: [], menus: [] }
export const EMPTY_ORDER: OpenOrder = { label: "", guests: [] }
const NO_ORDERS: ClosedOrder[] = []

export const catalogAtom = stored("pos:catalog", Catalog, EMPTY_CATALOG)
export const orderAtom = stored("pos:order", OpenOrder, EMPTY_ORDER)
export const historyAtom = stored("pos:history", Schema.Array(ClosedOrder), NO_ORDERS)

export function money(value: number) {
  const digits = Number.isInteger(value) ? 0 : 2
  return `${value.toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits })} $`
}

export const guestName = (guest: Guest, index: number) => guest.name.trim() || `Person ${index + 1}`
export const guestTotal = (guest: Guest) => guest.lines.reduce((sum, line) => sum + line.price * line.qty, 0)
export const guestsTotal = (guests: Guest[]) => guests.reduce((sum, guest) => sum + guestTotal(guest), 0)

export function newGuest(): Guest {
  return { id: crypto.randomUUID(), name: "", lines: [], paid: false }
}

/** What a tile of the catalog adds to a guest. */
export type Entry = Pick<Line, "ref" | "name" | "price" | "parts">

export function productEntry(product: Product): Entry {
  return { ref: product.id, name: product.name, price: product.price }
}

export function menuEntry(menu: Menu, products: Product[]): Entry {
  const parts = menu.productIds.flatMap((id) => products.find((p) => p.id === id)?.name.trim() || [])
  return { ref: menu.id, name: menu.name, price: menu.price, parts }
}

function mapGuest(order: OpenOrder, guestId: string, change: (guest: Guest) => Guest): OpenOrder {
  return { ...order, guests: order.guests.map((g) => (g.id === guestId ? change(g) : g)) }
}

/** Adds `entry` to the guest. The same entry without a note counts up instead of adding a line. */
export function addEntry(order: OpenOrder, guestId: string, entry: Entry): OpenOrder {
  return mapGuest(order, guestId, (guest) => {
    const same = guest.lines.find((l) => l.ref === entry.ref && l.price === entry.price && !l.note.trim())
    const lines = same
      ? guest.lines.map((l) => (l === same ? { ...l, qty: l.qty + 1 } : l))
      : [...guest.lines, { ...entry, id: crypto.randomUUID(), qty: 1, note: "" }]
    return { ...guest, lines }
  })
}

/** Changes a line; a quantity below one removes it. */
export function patchLine(order: OpenOrder, guestId: string, lineId: string, patch: Partial<Pick<Line, "qty" | "note">>): OpenOrder {
  return mapGuest(order, guestId, (guest) => ({
    ...guest,
    lines: guest.lines.flatMap((l) => (l.id !== lineId ? l : (patch.qty ?? l.qty) < 1 ? [] : { ...l, ...patch })),
  }))
}

/**
 * Marks the guests as paid. Once everyone who ordered has paid, the order is `closed` for
 * the history and a new one starts.
 */
export function settle(order: OpenOrder, guestIds: string[]): { order: OpenOrder; closed?: ClosedOrder } {
  const guests = order.guests.map((g) => (guestIds.includes(g.id) ? { ...g, paid: true } : g))
  const ordered = guests.filter((g) => g.lines.length > 0)
  if (ordered.length === 0 || ordered.some((g) => !g.paid)) return { order: { ...order, guests } }
  return {
    order: EMPTY_ORDER,
    // Names are fixed here, so "Person 2" stays "Person 2" without the empty guests around it.
    closed: {
      id: crypto.randomUUID(),
      label: order.label.trim(),
      guests: guests.flatMap((g, i) => (g.lines.length > 0 ? { ...g, name: guestName(g, i) } : [])),
      closedAt: new Date().toISOString(),
    },
  }
}
