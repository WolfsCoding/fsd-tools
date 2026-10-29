import { useEffect, useRef, useState } from "react"
import { CopyIcon, ImageDownIcon, PlusIcon, ReceiptIcon, RotateCcwIcon, SlidersHorizontalIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { Hint } from "@/components/hint"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useAtom } from "@effect/atom-react"
import { useTabTitle } from "@/hooks/use-tabs"
import {
  DEFAULT_RECEIPT,
  drawReceipt,
  loadFonts,
  money,
  newItem,
  pngFileName,
  receiptPng,
  receiptTotal,
  WIDTH,
  type Payment,
  type Receipt,
  type ReceiptItem,
} from "./render"
import { receiptAtom, receiptScaleAtom } from "./storage"

/** Receipts on thermal paper, just for fun: shop, items and payment, exported as PNG. */
export function ReceiptsPage() {
  useTabTitle("Kassenbon")
  const [stored, setStored] = useAtom(receiptAtom)
  const [scale, setScale] = useAtom(receiptScaleAtom)
  const receipt: Receipt = { ...DEFAULT_RECEIPT, ...stored }
  const update = (patch: Partial<Receipt>) => setStored((prev) => ({ ...DEFAULT_RECEIPT, ...prev, ...patch }))

  return (
    <div className="@container flex min-h-0 flex-1">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 @3xl:flex-row @3xl:overflow-hidden">
        <ReceiptForm
          receipt={receipt}
          onChange={update}
          onReset={() => {
            setStored(DEFAULT_RECEIPT)
            toast("Kassenbon zurückgesetzt", { action: { label: "Rückgängig", onClick: () => setStored(stored) } })
          }}
        />
        <Preview receipt={receipt} scale={scale} onScale={setScale} />
      </div>
    </div>
  )
}

function ReceiptForm({
  receipt,
  onChange,
  onReset,
}: {
  receipt: Receipt
  onChange: (patch: Partial<Receipt>) => void
  onReset: () => void
}) {
  const [addedId, setAddedId] = useState<string>()
  const setItem = (id: string, patch: Partial<ReceiptItem>) =>
    onChange({ items: receipt.items.map((item) => (item.id === id ? { ...item, ...patch } : item)) })

  return (
    <Card className="shrink-0 @3xl:min-h-0 @3xl:w-[26rem] @5xl:w-[30rem]">
      <CardHeader className="flex items-center gap-2 border-b">
        <CardTitle className="mr-auto flex items-center gap-2">
          <SlidersHorizontalIcon className="size-4 text-muted-foreground" />
          Kassenbon
        </CardTitle>
        <Hint label="Alles zurücksetzen">
          <Button variant="ghost" size="icon-sm" onClick={onReset} aria-label="Alles zurücksetzen">
            <RotateCcwIcon />
          </Button>
        </Hint>
      </CardHeader>

      <CardContent className="grid content-start gap-5 @3xl:min-h-0 @3xl:overflow-y-auto">
        <div className="grid gap-2">
          <Label htmlFor="receipt-shop">Geschäft</Label>
          <Input id="receipt-shop" value={receipt.shop} onChange={(e) => onChange({ shop: e.target.value })} autoFocus />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="receipt-address">Adresse</Label>
          <Textarea
            id="receipt-address"
            value={receipt.address}
            onChange={(e) => onChange({ address: e.target.value })}
            rows={2}
            className="min-h-0"
          />
        </div>

        <Separator />

        <div className="grid gap-2">
          <div className="grid grid-cols-[1fr_4rem_5.5rem_2rem] gap-2 text-sm font-medium">
            <span>Artikel</span>
            <span>Menge</span>
            <span>Preis</span>
          </div>
          {receipt.items.map((item) => (
            <div key={item.id} className="grid grid-cols-[1fr_4rem_5.5rem_2rem] items-center gap-2">
              <Input
                value={item.name}
                onChange={(e) => setItem(item.id, { name: e.target.value })}
                placeholder="Artikel"
                aria-label="Artikel"
                autoFocus={item.id === addedId}
              />
              <NumberField value={item.qty} onChange={(qty) => setItem(item.id, { qty })} label="Menge" />
              <NumberField value={item.price} onChange={(price) => setItem(item.id, { price })} label="Preis" />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onChange({ items: receipt.items.filter((other) => other.id !== item.id) })}
                aria-label="Artikel entfernen"
              >
                <Trash2Icon />
              </Button>
            </div>
          ))}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const item = newItem()
                setAddedId(item.id)
                onChange({ items: [...receipt.items, item] })
              }}
            >
              <PlusIcon /> Artikel
            </Button>
            <span className="text-sm text-muted-foreground">
              Summe <span className="font-mono text-foreground">{money(receiptTotal(receipt), receipt.currency)}</span>
            </span>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label id="receipt-payment">Zahlung</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={receipt.payment}
              onValueChange={(v) => v && onChange({ payment: v as Payment })}
              aria-labelledby="receipt-payment"
            >
              <ToggleGroupItem value="cash" className="px-3">
                Bar
              </ToggleGroupItem>
              <ToggleGroupItem value="card" className="px-3">
                Karte
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          {receipt.payment === "cash" && (
            <div className="grid gap-2">
              <Label htmlFor="receipt-given">Gegeben</Label>
              <NumberField id="receipt-given" value={receipt.given} onChange={(given) => onChange({ given })} label="Gegeben" />
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="receipt-currency">Währung</Label>
            <Input id="receipt-currency" value={receipt.currency} onChange={(e) => onChange({ currency: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="receipt-tax">MwSt in %</Label>
            <NumberField id="receipt-tax" value={receipt.taxRate} onChange={(taxRate) => onChange({ taxRate })} label="MwSt" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="receipt-number">Bon-Nr.</Label>
            <Input id="receipt-number" value={receipt.number} onChange={(e) => onChange({ number: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="receipt-cashier">Kasse</Label>
            <Input id="receipt-cashier" value={receipt.cashier} onChange={(e) => onChange({ cashier: e.target.value })} />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="receipt-date">
            Datum <span className="font-normal text-muted-foreground">(leer = jetzt)</span>
          </Label>
          <div className="flex gap-2">
            <Input
              id="receipt-date"
              type="datetime-local"
              value={receipt.date}
              onChange={(e) => onChange({ date: e.target.value })}
            />
            <Button variant="outline" onClick={() => onChange({ date: "" })} disabled={!receipt.date}>
              Jetzt
            </Button>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="receipt-footer">Fußzeile</Label>
          <Textarea
            id="receipt-footer"
            value={receipt.footer}
            onChange={(e) => onChange({ footer: e.target.value })}
            rows={2}
            className="min-h-0"
          />
        </div>
      </CardContent>
    </Card>
  )
}

/** A number typed with comma or point; half typed numbers stay in a draft. */
function NumberField({ id, value, onChange, label }: { id?: string; value: number; onChange: (value: number) => void; label: string }) {
  const [draft, setDraft] = useState(String(value).replace(".", ","))
  const [shown, setShown] = useState(value)
  if (shown !== value) {
    setShown(value)
    setDraft(String(value).replace(".", ","))
  }
  const parse = (v: string) => Number(v.trim().replace(",", "."))
  const valid = draft.trim() !== "" && Number.isFinite(parse(draft)) && parse(draft) >= 0

  return (
    <Input
      id={id}
      value={draft}
      inputMode="decimal"
      onChange={(e) => {
        setDraft(e.target.value)
        const next = parse(e.target.value)
        if (e.target.value.trim() !== "" && Number.isFinite(next) && next >= 0) {
          setShown(next)
          onChange(next)
        }
      }}
      onBlur={() => setDraft(String(value).replace(".", ","))}
      aria-label={id ? undefined : label}
      aria-invalid={!valid}
      className="font-mono"
    />
  )
}

function Preview({ receipt, scale, onScale }: { receipt: Receipt; scale: number; onScale: (scale: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    loadFonts().finally(() => active && setReady(true))
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (ready && canvasRef.current) drawReceipt(canvasRef.current, receipt, Math.max(2, window.devicePixelRatio || 1))
  })

  async function exportPng(mode: "copy" | "download") {
    setBusy(true)
    try {
      if (mode === "copy") {
        // Passing the promise keeps the user gesture alive in Safari while the PNG is drawn.
        await navigator.clipboard.write([new ClipboardItem({ "image/png": receiptPng(receipt, scale) })])
        toast.success("Bild kopiert")
      } else {
        const url = URL.createObjectURL(await receiptPng(receipt, scale))
        const a = document.createElement("a")
        a.href = url
        a.download = pngFileName(receipt.shop)
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    } catch {
      toast.error(mode === "copy" ? "Kopieren nicht möglich – lade das Bild stattdessen herunter." : "Export fehlgeschlagen")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="min-w-0 shrink-0 grow pb-0 @3xl:min-h-0 @3xl:flex-1">
      <CardHeader className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b">
        <div className="mr-auto grid gap-1">
          <CardTitle className="flex items-center gap-2">
            <ReceiptIcon className="size-4 text-muted-foreground" />
            Vorschau
          </CardTitle>
          <CardDescription>{WIDTH * scale} px breit, transparenter Rand</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={String(scale)}
            onValueChange={(v) => v && onScale(Number(v))}
            aria-label="Größe"
          >
            <ToggleGroupItem value="1" className="px-2.5">
              1×
            </ToggleGroupItem>
            <ToggleGroupItem value="2" className="px-2.5">
              2×
            </ToggleGroupItem>
          </ToggleGroup>
          <Separator orientation="vertical" className="mx-1 h-5!" />
          <Button variant="outline" size="sm" onClick={() => exportPng("copy")} disabled={busy || !ready}>
            <CopyIcon /> Kopieren
          </Button>
          <Button size="sm" onClick={() => exportPng("download")} disabled={busy || !ready}>
            <ImageDownIcon /> PNG
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 px-0">
        {/* A dotted board, so the torn edges show. */}
        <div className="flex min-h-0 flex-1 overflow-auto bg-[radial-gradient(var(--color-border)_1px,transparent_1px)] [background-size:14px_14px] p-6">
          <canvas
            ref={canvasRef}
            style={{ width: WIDTH }}
            className={cn("m-auto h-auto max-w-full shrink-0 drop-shadow-md", !ready && "invisible")}
            aria-label={`Vorschau: Kassenbon ${receipt.shop}`}
          />
        </div>
      </CardContent>
    </Card>
  )
}
