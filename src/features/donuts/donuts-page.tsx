import { useState } from "react"
import { CoinsIcon, DonutIcon } from "lucide-react"
import { cn } from "cn"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useTabTitle } from "@/hooks/use-tabs"

const PACK_SIZE = 10
const PACK_PRICE = 75
const SINGLE_PRICE = 8

const dollars = (n: number) => `${n.toLocaleString("de-DE")} $`

export function DonutsPage() {
  useTabTitle("Donut-Rechner")
  const [draft, setDraft] = useState("10")
  const count = Math.max(0, Math.floor(Number(draft) || 0))
  const packs = Math.floor(count / PACK_SIZE)
  const singles = count % PACK_SIZE
  const total = packs * PACK_PRICE + singles * SINGLE_PRICE

  const [budgetDraft, setBudgetDraft] = useState("100")
  const budget = Math.max(0, Number(budgetDraft.replace(",", ".")) || 0)
  const budgetPacks = Math.floor(budget / PACK_PRICE)
  const budgetSingles = Math.floor((budget - budgetPacks * PACK_PRICE) / SINGLE_PRICE)
  const spent = budgetPacks * PACK_PRICE + budgetSingles * SINGLE_PRICE

  return (
    <div className="flex flex-1 flex-wrap content-center items-stretch justify-center gap-4 overflow-y-auto p-4">
      <Card className="w-sm max-w-full">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <DonutIcon className="size-4 text-muted-foreground" />
            Preis für Donuts
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="donut-count">Anzahl Donuts</Label>
            <Input
              id="donut-count"
              type="number"
              min={0}
              step={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid gap-1 text-sm">
            <Row label={`${packs} × ${PACK_SIZE}er à ${dollars(PACK_PRICE)}`} value={dollars(packs * PACK_PRICE)} />
            <Row label={`${singles} × einzeln à ${dollars(SINGLE_PRICE)}`} value={dollars(singles * SINGLE_PRICE)} />
          </div>
          <Separator />
          <Row label="Gesamt" value={dollars(total)} className="text-lg font-semibold" />
        </CardContent>
      </Card>

      <Card className="w-sm max-w-full">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <CoinsIcon className="size-4 text-muted-foreground" />
            Donuts für Betrag
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="donut-budget">Betrag in $</Label>
            <Input
              id="donut-budget"
              inputMode="decimal"
              value={budgetDraft}
              onChange={(e) => setBudgetDraft(e.target.value)}
            />
          </div>
          <div className="grid gap-1 text-sm">
            <Row label={`${budgetPacks} × ${PACK_SIZE}er à ${dollars(PACK_PRICE)}`} value={dollars(budgetPacks * PACK_PRICE)} />
            <Row label={`${budgetSingles} × einzeln à ${dollars(SINGLE_PRICE)}`} value={dollars(budgetSingles * SINGLE_PRICE)} />
            <Row label="Rest" value={dollars(budget - spent)} className="text-muted-foreground" />
          </div>
          <Separator />
          <Row label="Donuts" value={String(budgetPacks * PACK_SIZE + budgetSingles)} className="text-lg font-semibold" />
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("flex justify-between gap-4", className)}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
