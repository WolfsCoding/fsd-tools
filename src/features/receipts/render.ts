// A thermal paper receipt drawn on a canvas; its height grows with the items.
export const WIDTH = 360
const PAD = 24
const CONTENT = WIDTH - PAD * 2
/** Height of the torn zigzag edge at the top and bottom. */
const TEAR = 8
const PAPER = "#fbfaf4"
const INK = "#26241f"
const MUTED = "#7a776d"
const MONO = '"JetBrains Mono Variable", ui-monospace, monospace'
const FONT = (size: number, weight = 400) => `${weight} ${size}px ${MONO}`

export type Payment = "cash" | "card"

export interface ReceiptItem {
  id: string
  name: string
  qty: number
  price: number
}

export interface Receipt {
  shop: string
  /** One line per address line, centered under the shop. */
  address: string
  items: ReceiptItem[]
  currency: string
  /** VAT in percent, contained in the prices; 0 leaves the line out. */
  taxRate: number
  payment: Payment
  /** Cash handed over, for the change. */
  given: number
  cashier: string
  number: string
  /** A datetime-local value; empty means now. */
  date: string
  footer: string
}

export const DEFAULT_RECEIPT: Receipt = {
  shop: "24/7 Supermarkt",
  address: "Grove Street 12\nLos Santos",
  items: [
    { id: "1", name: "Wasser 0,5l", qty: 2, price: 1.5 },
    { id: "2", name: "Sandwich Schinken-Käse", qty: 1, price: 4.99 },
    { id: "3", name: "Kaffee to go", qty: 1, price: 2.8 },
  ],
  currency: "$",
  taxRate: 19,
  payment: "cash",
  given: 20,
  cashier: "Kasse 2 · Mia",
  number: "004711",
  date: "",
  footer: "Vielen Dank für Ihren Einkauf!\nBis zum nächsten Mal.",
}

export function newItem(): ReceiptItem {
  return { id: crypto.randomUUID(), name: "", qty: 1, price: 0 }
}

export function receiptTotal(receipt: Receipt) {
  return receipt.items.reduce((sum, item) => sum + item.qty * item.price, 0)
}

const number = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function money(value: number, currency: string) {
  return `${number.format(value)} ${currency}`.trim()
}

type Row =
  | { kind: "text"; left: string; right?: string; align?: "left" | "center"; size?: number; weight?: number; muted?: boolean }
  | { kind: "rule"; double?: boolean }
  | { kind: "space"; height: number }
  | { kind: "barcode" }

const LINE = 1.45
const BARCODE_HEIGHT = 54

function rowHeight(row: Row) {
  if (row.kind === "text") return (row.size ?? 13) * LINE
  if (row.kind === "rule") return 14
  if (row.kind === "space") return row.height
  return BARCODE_HEIGHT + 18
}

/** Splits `text` into lines of at most `max` characters, breaking at spaces where it can. */
function wrap(text: string, max: number) {
  const lines: string[] = []
  let line = ""
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (!line) line = word
    else if (line.length + 1 + word.length <= max) line += " " + word
    else {
      lines.push(line)
      line = word
    }
    while (line.length > max) {
      lines.push(line.slice(0, max))
      line = line.slice(max)
    }
  }
  return line || !lines.length ? [...lines, line] : lines
}

function formatDate(value: string) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return { day: value, time: "" }
  return {
    day: date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }),
    time: date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
  }
}

/** The receipt as rows from top to bottom; `chars` is how many characters fit a line. */
function layout(receipt: Receipt, chars: number): Row[] {
  const rows: Row[] = []
  const cur = receipt.currency.trim()
  const center = (text: string, opts: Partial<Extract<Row, { kind: "text" }>> = {}) => {
    for (const line of text.split("\n")) if (line.trim()) rows.push({ kind: "text", left: line.trim(), align: "center", ...opts })
  }

  rows.push({ kind: "space", height: 10 })
  if (receipt.shop.trim()) center(receipt.shop.toUpperCase(), { size: 20, weight: 800 })
  center(receipt.address, { size: 12, muted: true })
  rows.push({ kind: "space", height: 6 }, { kind: "rule" })

  for (const item of receipt.items) {
    const total = money(item.qty * item.price, cur)
    // The price takes the end of the first line; the name wraps in front of it.
    const lines = wrap(item.name.trim() || "Artikel", chars - total.length - 2)
    lines.forEach((line, i) => rows.push({ kind: "text", left: line, right: i === 0 ? total : undefined }))
    if (item.qty !== 1) rows.push({ kind: "text", left: `  ${number.format(item.qty).replace(/,00$/, "")} x ${money(item.price, cur)}`, size: 12, muted: true })
  }

  const total = receiptTotal(receipt)
  rows.push({ kind: "rule" }, { kind: "text", left: "SUMME", right: money(total, cur), size: 18, weight: 800 }, { kind: "rule", double: true })

  if (receipt.payment === "cash") {
    rows.push({ kind: "text", left: "Bar gegeben", right: money(receipt.given, cur) })
    rows.push({ kind: "text", left: "Rückgeld", right: money(Math.max(0, receipt.given - total), cur) })
  } else {
    rows.push({ kind: "text", left: "Kartenzahlung", right: money(total, cur) })
    rows.push({ kind: "text", left: "Zahlung erfolgt", size: 12, muted: true })
  }

  if (receipt.taxRate > 0) {
    const tax = total - total / (1 + receipt.taxRate / 100)
    rows.push({ kind: "space", height: 8 })
    rows.push({ kind: "text", left: `MwSt ${number.format(receipt.taxRate).replace(/,00$/, "")} %`, right: money(tax, cur), size: 12, muted: true })
    rows.push({ kind: "text", left: "Netto", right: money(total - tax, cur), size: 12, muted: true })
  }

  const { day, time } = formatDate(receipt.date)
  rows.push({ kind: "rule" })
  rows.push({ kind: "text", left: `${day} ${time}`.trim(), right: receipt.number.trim() ? `Bon ${receipt.number.trim()}` : undefined, size: 12 })
  if (receipt.cashier.trim()) rows.push({ kind: "text", left: receipt.cashier.trim(), size: 12, muted: true })

  if (receipt.footer.trim()) {
    rows.push({ kind: "space", height: 12 })
    for (const line of receipt.footer.split("\n")) for (const part of wrap(line, chars)) if (part) center(part, { size: 12 })
  }
  rows.push({ kind: "space", height: 14 }, { kind: "barcode" }, { kind: "space", height: 10 })
  return rows
}

/** Bar widths from the receipt number, so the same number always gives the same code. */
function bars(code: string) {
  let seed = 7
  for (const ch of code || "0") seed = (seed * 31 + ch.charCodeAt(0)) >>> 0
  const widths: number[] = []
  for (let i = 0; i < 64; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0
    widths.push(1 + ((seed >>> 16) % 3))
  }
  return widths
}

/** The paper outline with zigzag tears at the top and bottom. */
function paperPath(ctx: CanvasRenderingContext2D, height: number) {
  const tooth = 12
  ctx.beginPath()
  ctx.moveTo(0, TEAR)
  for (let x = 0; x < WIDTH; x += tooth) {
    ctx.lineTo(x + tooth / 2, 0)
    ctx.lineTo(Math.min(WIDTH, x + tooth), TEAR)
  }
  ctx.lineTo(WIDTH, height - TEAR)
  for (let x = WIDTH; x > 0; x -= tooth) {
    ctx.lineTo(x - tooth / 2, height)
    ctx.lineTo(Math.max(0, x - tooth), height - TEAR)
  }
  ctx.closePath()
}

/** Waits until the canvas can draw with the receipt's font. */
export function loadFonts() {
  return Promise.all([document.fonts.load(FONT(13)), document.fonts.load(FONT(20, 800))]).then(() => undefined)
}

/** Draws the receipt onto `canvas`, `scale` pixels per CSS pixel; outside the paper stays transparent. */
export function drawReceipt(canvas: HTMLCanvasElement, receipt: Receipt, scale: number) {
  const ctx = canvas.getContext("2d")!
  ctx.font = FONT(13)
  const chars = Math.floor(CONTENT / ctx.measureText("0").width)
  const rows = layout(receipt, chars)
  const height = Math.ceil(TEAR * 2 + rows.reduce((sum, row) => sum + rowHeight(row), 0))

  canvas.width = Math.round(WIDTH * scale)
  canvas.height = Math.round(height * scale)
  ctx.setTransform(scale, 0, 0, scale, 0, 0)

  paperPath(ctx, height)
  ctx.fillStyle = PAPER
  ctx.fill()

  let y = TEAR
  ctx.textBaseline = "middle"
  for (const row of rows) {
    const h = rowHeight(row)
    const mid = y + h / 2
    if (row.kind === "text") {
      ctx.font = FONT(row.size ?? 13, row.weight)
      ctx.fillStyle = row.muted ? MUTED : INK
      ctx.textAlign = row.align === "center" ? "center" : "left"
      ctx.fillText(row.left, row.align === "center" ? WIDTH / 2 : PAD, mid, CONTENT)
      if (row.right) {
        ctx.textAlign = "right"
        ctx.fillText(row.right, WIDTH - PAD, mid)
      }
    } else if (row.kind === "rule") {
      ctx.strokeStyle = INK
      ctx.lineWidth = 1
      ctx.setLineDash([4, 3])
      for (const offset of row.double ? [-2, 2] : [0]) {
        ctx.beginPath()
        ctx.moveTo(PAD, Math.round(mid + offset) + 0.5)
        ctx.lineTo(WIDTH - PAD, Math.round(mid + offset) + 0.5)
        ctx.stroke()
      }
      ctx.setLineDash([])
    } else if (row.kind === "barcode") {
      const widths = bars(receipt.number)
      const total = widths.reduce((sum, w, i) => sum + w + (i % 2 ? 0 : 1), 0)
      let x = (WIDTH - total) / 2
      ctx.fillStyle = INK
      widths.forEach((w, i) => {
        if (i % 2 === 0) ctx.fillRect(x, y, w, BARCODE_HEIGHT)
        x += w + (i % 2 ? 0 : 1)
      })
      ctx.font = FONT(11)
      ctx.textAlign = "center"
      ctx.fillText(receipt.number.trim() || "0000", WIDTH / 2, y + BARCODE_HEIGHT + 10)
    }
    y += h
  }
}

export async function receiptPng(receipt: Receipt, scale: number) {
  await loadFonts()
  const canvas = document.createElement("canvas")
  drawReceipt(canvas, receipt, scale)
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG konnte nicht erstellt werden"))), "image/png"),
  )
}

/** "kassenbon-24-7-supermarkt.png" */
export function pngFileName(shop: string) {
  const slug = shop
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
  return slug ? `kassenbon-${slug}.png` : "kassenbon.png"
}
