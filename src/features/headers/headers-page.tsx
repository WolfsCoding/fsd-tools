import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { CopyIcon, ImageDownIcon, ImageIcon, RotateCcwIcon, SlidersHorizontalIcon, UploadIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { Hint } from "@/components/hint"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useTabTitle } from "@/hooks/use-tabs"
import { useLocalStorage } from "@/lib/local-storage"
import {
  DEFAULT_DESIGN,
  drawHeader,
  headerPng,
  HEIGHT,
  loadFonts,
  loadImage,
  logoDataUrl,
  LOGOS,
  logoSrc,
  pngFileName,
  WIDTH,
  type HeaderDesign,
  type LogoId,
} from "./render"
import { HEADER_KEY, HEADER_SCALE_KEY } from "./storage"

const DEFAULT_SCALE = 1

/** Header images for case files: title, subtitle and seal on the navy band, exported as PNG. */
export function HeadersPage() {
  useTabTitle("Header-Bilder")
  const [stored, setStored] = useLocalStorage<Partial<HeaderDesign>>(HEADER_KEY, DEFAULT_DESIGN)
  const [scale, setScale] = useLocalStorage(HEADER_SCALE_KEY, DEFAULT_SCALE)
  const design: HeaderDesign = { ...DEFAULT_DESIGN, ...stored }
  const update = (patch: Partial<HeaderDesign>) => setStored((prev) => ({ ...DEFAULT_DESIGN, ...prev, ...patch }))

  return (
    <div className="@container flex min-h-0 flex-1">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 @3xl:flex-row @3xl:overflow-hidden">
        <DesignForm design={design} onChange={update} onReset={() => setStored(DEFAULT_DESIGN)} />
        <Preview design={design} scale={scale} onScale={setScale} />
      </div>
    </div>
  )
}

function DesignForm({
  design,
  onChange,
  onReset,
}: {
  design: HeaderDesign
  onChange: (patch: Partial<HeaderDesign>) => void
  onReset: () => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    try {
      onChange({ logo: "custom", customLogo: await logoDataUrl(file) })
    } catch {
      toast.error("Das Bild konnte nicht gelesen werden")
    }
  }

  return (
    <Card className="shrink-0 @3xl:min-h-0 @3xl:w-[22rem] @5xl:w-[26rem]">
      <CardHeader className="flex items-center gap-2 border-b">
        <CardTitle className="mr-auto flex items-center gap-2">
          <SlidersHorizontalIcon className="size-4 text-muted-foreground" />
          Gestaltung
        </CardTitle>
        <Hint label="Alles zurücksetzen">
          <Button variant="ghost" size="icon-sm" onClick={onReset} aria-label="Alles zurücksetzen">
            <RotateCcwIcon />
          </Button>
        </Hint>
      </CardHeader>

      <CardContent className="grid content-start gap-5 @3xl:min-h-0 @3xl:overflow-y-auto">
        <div className="grid gap-2">
          <Label htmlFor="header-title">Titel</Label>
          <Input
            id="header-title"
            value={design.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Strafakte"
            autoFocus
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="header-subtitle">Untertitel</Label>
          <Input
            id="header-subtitle"
            value={design.subtitle}
            onChange={(e) => onChange({ subtitle: e.target.value })}
            placeholder="Leer lassen für keinen Untertitel"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="header-note">
            2. Untertitel <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="header-note"
            value={design.note ?? ""}
            onChange={(e) => onChange({ note: e.target.value })}
            placeholder="Kleiner, ganz unten"
          />
        </div>

        <div className="grid gap-2">
          <Label id="header-logo">Logo</Label>
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={design.logo}
              onValueChange={(v) => {
                if (v === "custom" && !design.customLogo) fileInput.current?.click()
                else if (v) onChange({ logo: v as LogoId })
              }}
              aria-labelledby="header-logo"
            >
              {Object.entries(LOGOS).map(([id, logo]) => (
                <ToggleGroupItem key={id} value={id} className="gap-1.5 px-2.5">
                  <img src={logo.src} alt="" className="size-5 rounded-full" />
                  {logo.label}
                </ToggleGroupItem>
              ))}
              <ToggleGroupItem value="custom" className="gap-1.5 px-2.5">
                {design.customLogo ? (
                  <img src={design.customLogo} alt="" className="size-5 rounded-full object-cover" />
                ) : (
                  <UploadIcon />
                )}
                Eigenes
              </ToggleGroupItem>
            </ToggleGroup>
            {design.customLogo && (
              <Button variant="ghost" size="sm" onClick={() => fileInput.current?.click()}>
                <UploadIcon /> Anderes Bild
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Eigene Logos werden rund zugeschnitten.</p>
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={onFile} />
        </div>

        <Separator />

        <ColorField
          id="header-band"
          label="Hintergrund"
          value={design.band}
          fallback={DEFAULT_DESIGN.band}
          onChange={(band) => onChange({ band })}
        />
        <ColorField
          id="header-accent"
          label="Akzent"
          value={design.accent}
          fallback={DEFAULT_DESIGN.accent}
          onChange={(accent) => onChange({ accent })}
        />

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="header-watermark" className="grid gap-1">
            Wasserzeichen
            <span className="text-xs font-normal text-muted-foreground">Das Logo blass in der rechten Ecke.</span>
          </Label>
          <Switch
            id="header-watermark"
            checked={design.watermark}
            onCheckedChange={(watermark) => onChange({ watermark })}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function ColorField({
  id,
  label,
  value,
  fallback,
  onChange,
}: {
  id: string
  label: string
  value: string
  fallback: string
  onChange: (value: string) => void
}) {
  // Typing goes through a draft, so half a color code doesn't reach the picture.
  const [draft, setDraft] = useState(value)
  const [shown, setShown] = useState(value)
  if (shown !== value) {
    setShown(value)
    setDraft(value)
  }
  const valid = (v: string) => /^#[0-9a-f]{6}$/i.test(v)

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="mr-auto">
        {label}
      </Label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label} wählen`}
        className="size-9 shrink-0 cursor-pointer appearance-none overflow-hidden rounded-lg border bg-transparent p-0 [&::-moz-color-swatch]:rounded-lg [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
      />
      <Input
        id={id}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          if (valid(e.target.value.trim())) onChange(e.target.value.trim().toLowerCase())
        }}
        onBlur={() => setDraft(value)}
        spellCheck={false}
        aria-invalid={!valid(draft.trim())}
        className="w-28 font-mono"
      />
      {/* The span keeps the tooltip working while the button is disabled. */}
      <Hint label={`Zurücksetzen auf ${fallback}`}>
        <span className="flex shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onChange(fallback)}
            disabled={value === fallback}
            aria-label={`${label} zurücksetzen`}
          >
            <RotateCcwIcon />
          </Button>
        </span>
      </Hint>
    </div>
  )
}

function Preview({ design, scale, onScale }: { design: HeaderDesign; scale: number; onScale: (scale: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const [loaded, setLoaded] = useState<{ src: string; img: HTMLImageElement }>()
  const [busy, setBusy] = useState(false)
  const src = logoSrc(design)
  const logo = loaded && loaded.src === src ? loaded.img : undefined

  useEffect(() => {
    let active = true
    loadFonts().finally(() => active && setReady(true))
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!src) return
    let active = true
    loadImage(src).then(
      (img) => active && setLoaded({ src, img }),
      () => toast.error("Logo konnte nicht geladen werden"),
    )
    return () => {
      active = false
    }
  }, [src])

  useEffect(() => {
    if (ready && canvasRef.current) drawHeader(canvasRef.current, design, logo, Math.max(2, window.devicePixelRatio || 1))
  })

  async function exportPng(mode: "copy" | "download") {
    setBusy(true)
    try {
      if (mode === "copy") {
        // Passing the promise keeps the user gesture alive in Safari while the PNG is drawn.
        await navigator.clipboard.write([new ClipboardItem({ "image/png": headerPng(design, scale) })])
        toast.success("Bild kopiert")
      } else {
        const url = URL.createObjectURL(await headerPng(design, scale))
        const a = document.createElement("a")
        a.href = url
        a.download = pngFileName(design.title)
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
    <Card className="min-w-0 flex-1 pb-0 @3xl:min-h-0">
      <CardHeader className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b">
        <div className="mr-auto grid gap-1">
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="size-4 text-muted-foreground" />
            Vorschau
          </CardTitle>
          <CardDescription>
            {WIDTH * scale} × {HEIGHT * scale} px, transparenter Rand
          </CardDescription>
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
            <Hint label={`${WIDTH} × ${HEIGHT} px, wie die bisherigen Header`}>
              <ToggleGroupItem value="1" className="px-2.5">
                1×
              </ToggleGroupItem>
            </Hint>
            <Hint label={`${WIDTH * 2} × ${HEIGHT * 2} px, scharf auf hochauflösenden Bildschirmen`}>
              <ToggleGroupItem value="2" className="px-2.5">
                2×
              </ToggleGroupItem>
            </Hint>
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
        {/* A dotted board, so the transparent edges show. */}
        <div className="flex min-h-0 flex-1 overflow-auto bg-[radial-gradient(var(--color-border)_1px,transparent_1px)] [background-size:14px_14px] p-6">
          <canvas
            ref={canvasRef}
            style={{ width: WIDTH, aspectRatio: `${WIDTH} / ${HEIGHT}` }}
            className={cn("m-auto h-auto max-w-full shrink-0", !ready && "invisible")}
            aria-label={`Vorschau: ${design.title}`}
          />
        </div>
      </CardContent>
    </Card>
  )
}
