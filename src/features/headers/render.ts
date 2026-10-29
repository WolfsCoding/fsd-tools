import "@fontsource-variable/source-serif-4/opsz.css"
import fastLogo from "./logos/logo-fast.webp"
import vpdLogo from "./logos/logo-vpd.webp"
import { HEADER_API } from "./paths"

// The case file header of scripts/case-header/header.html, drawn on a canvas.
export const WIDTH = 800
export const HEIGHT = 160
/** The navy band leaves this much room above and below for the seal to stick out. */
const BAND_INSET = 18
const BAND_RADIUS = 12
const LOGO_X = 14
const LOGO_SIZE = 160
/** The text column right of the seal. */
const TEXT_LEFT = 186
const TEXT_RIGHT = WIDTH - 24
/** Long titles shrink until they fit this width, but not below MIN_TITLE_SIZE. */
const TITLE_MAX_WIDTH = 470
const TITLE_SIZE = 54
const TITLE_SIZE_WITH_NOTE = 44
const MIN_TITLE_SIZE = 32
const TITLE_FONT = (size: number) => `700 ${size}px "Source Serif 4 Variable", serif`
const SUB_FONT = '500 12px "Inter Variable", system-ui, sans-serif'
const NOTE_FONT = '500 13px "Inter Variable", system-ui, sans-serif'
const SUB_LINE_WIDTH = 54

export type LogoId = "vpd" | "fast" | "custom"

export const LOGOS: Record<Exclude<LogoId, "custom">, { label: string; src: string }> = {
  vpd: { label: "VPD", src: vpdLogo },
  fast: { label: "FAST", src: fastLogo },
}

export interface HeaderDesign {
  title: string
  subtitle: string
  /** Optional smaller line at the very bottom, e.g. a date or file number. */
  note?: string
  logo: LogoId
  /** Data URL of an own logo, used when `logo` is "custom". */
  customLogo?: string
  band: string
  accent: string
  /** The faint seal in the band's right corner. */
  watermark: boolean
}

export const DEFAULT_DESIGN: HeaderDesign = {
  title: "Strafakte",
  subtitle: "Vinewood Police Department",
  logo: "vpd",
  band: "#1f2d55",
  accent: "#e3b53b",
  watermark: true,
}

export function logoSrc(design: HeaderDesign) {
  return design.logo === "custom" ? design.customLogo : LOGOS[design.logo].src
}

const images = new Map<string, Promise<HTMLImageElement>>()

export function loadImage(src: string) {
  let image = images.get(src)
  if (!image) {
    image = new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error("Logo konnte nicht geladen werden"))
      img.src = src
    })
    images.set(src, image)
  }
  return image
}

/** Waits until the canvas can draw with the header's fonts. */
export function loadFonts() {
  return Promise.all([document.fonts.load(TITLE_FONT(TITLE_SIZE)), document.fonts.load(SUB_FONT)]).then(() => undefined)
}

/** The seal cut to a circle, so square logos look like the round ones. */
function roundLogo(logo: HTMLImageElement, scale: number) {
  const size = Math.round(LOGO_SIZE * scale)
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.clip()
  drawCover(ctx, logo, 0, 0, size, size)
  return canvas
}

/** Draws `img` filling the square like `object-fit: cover`. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ratio = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const sw = w / ratio
  const sh = h / ratio
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h)
}

/** Gold and white stripes along an edge of the band; `flip` mirrors them for the bottom edge. */
function stripes(ctx: CanvasRenderingContext2D, y: number, accent: string, flip: boolean) {
  const line = (offset: number, height: number, color: string) => {
    ctx.fillStyle = color
    ctx.fillRect(0, flip ? y + 9 - offset - height : y + offset, WIDTH, height)
  }
  line(0, 2, accent)
  line(4, 1, "#ffffff")
}

/** Draws the header onto `canvas`, `scale` pixels per CSS pixel; outside the band stays transparent. */
export function drawHeader(canvas: HTMLCanvasElement, design: HeaderDesign, logo: HTMLImageElement | undefined, scale: number) {
  canvas.width = Math.round(WIDTH * scale)
  canvas.height = Math.round(HEIGHT * scale)
  const ctx = canvas.getContext("2d")!
  ctx.setTransform(scale, 0, 0, scale, 0, 0)

  const bandTop = BAND_INSET
  const bandBottom = HEIGHT - BAND_INSET
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(0, bandTop, WIDTH, bandBottom - bandTop, BAND_RADIUS)
  ctx.fillStyle = design.band
  ctx.fill()
  ctx.clip()
  if (logo && design.watermark) {
    ctx.save()
    ctx.globalAlpha = 0.07
    ctx.filter = "grayscale(1) brightness(2.5)"
    const size = 240
    ctx.drawImage(roundLogo(logo, scale), WIDTH + 70 - size, bandTop - 50, size, size)
    ctx.restore()
  }
  stripes(ctx, bandTop + 8, design.accent, false)
  stripes(ctx, bandBottom - 17, design.accent, true)
  ctx.restore()

  if (logo) {
    ctx.save()
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)"
    ctx.shadowBlur = 6 * scale
    ctx.shadowOffsetY = 2 * scale
    ctx.drawImage(roundLogo(logo, scale), LOGO_X, 0, LOGO_SIZE, LOGO_SIZE)
    ctx.restore()
  }

  // Title, subtitle and note as one centered column, like the flex box of the HTML.
  const title = design.title.trim()
  const subtitle = design.subtitle.trim().toUpperCase()
  const note = (design.note ?? "").trim()
  // The note needs room between the stripes, so the title starts smaller with one.
  let size = note ? TITLE_SIZE_WITH_NOTE : TITLE_SIZE
  ctx.font = TITLE_FONT(size)
  while (ctx.measureText(title).width > TITLE_MAX_WIDTH && size > MIN_TITLE_SIZE) ctx.font = TITLE_FONT(--size)
  const titleHeight = size * 1.22
  const subHeight = subtitle ? 14.5 : 0
  const gap = subtitle ? 3 : 0
  const noteHeight = note ? 16 : 0
  const noteGap = note ? 4 : 0
  const top = bandTop + (bandBottom - bandTop - titleHeight - gap - subHeight - noteGap - noteHeight) / 2
  const center = (TEXT_LEFT + TEXT_RIGHT) / 2

  ctx.fillStyle = "#ffffff"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(title, center, top + titleHeight / 2, TEXT_RIGHT - TEXT_LEFT)

  if (subtitle) {
    const y = top + titleHeight + gap + subHeight / 2
    ctx.font = SUB_FONT
    ctx.letterSpacing = "1.92px"
    // CSS letter spacing also trails the last letter; leave it out so the text sits centered.
    const textWidth = ctx.measureText(subtitle).width - 1.92
    ctx.textAlign = "left"
    ctx.fillText(subtitle, center - textWidth / 2, y)
    ctx.letterSpacing = "0px"
    ctx.fillStyle = design.accent
    ctx.fillRect(center - textWidth / 2 - 12 - SUB_LINE_WIDTH, y - 1, SUB_LINE_WIDTH, 2)
    ctx.fillRect(center + textWidth / 2 + 12, y - 1, SUB_LINE_WIDTH, 2)
  }

  if (note) {
    ctx.font = NOTE_FONT
    ctx.textAlign = "center"
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)"
    ctx.fillText(note, center, top + titleHeight + gap + subHeight + noteGap + noteHeight / 2, TEXT_RIGHT - TEXT_LEFT)
  }
}

export async function headerPng(design: HeaderDesign, scale: number) {
  const src = logoSrc(design)
  const [logo] = await Promise.all([src ? loadImage(src) : undefined, loadFonts()])
  const canvas = document.createElement("canvas")
  drawHeader(canvas, design, logo, scale)
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG konnte nicht erstellt werden"))), "image/png"),
  )
}

/** Shrinks an uploaded logo to a square PNG data URL small enough for localStorage. */
export async function logoDataUrl(file: File) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error("Das Bild konnte nicht gelesen werden"))
      image.src = url
    })
    // Twice the seal's size, so 2× exports stay sharp.
    const size = Math.min(LOGO_SIZE * 2, Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    drawCover(canvas.getContext("2d")!, img, 0, 0, size, size)
    return canvas.toDataURL("image/webp", 0.9)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * The link of the same header on the hosted API; like its own designer, only options that differ
 * from the defaults go in. Undefined for an own logo, since the API only takes https URLs.
 */
export function headerUrl(design: HeaderDesign, scale: number) {
  if (design.logo === "custom") return undefined
  const params = new URLSearchParams({ title: design.title })
  if (design.subtitle !== DEFAULT_DESIGN.subtitle) params.set("subtitle", design.subtitle)
  if (design.note?.trim()) params.set("note", design.note)
  if (design.logo !== "vpd") params.set("logo", design.logo)
  if (design.band !== DEFAULT_DESIGN.band) params.set("band", design.band.slice(1))
  if (design.accent !== DEFAULT_DESIGN.accent) params.set("accent", design.accent.slice(1))
  if (!design.watermark) params.set("watermark", "0")
  if (scale !== 1) params.set("scale", String(scale))
  return `${HEADER_API}?${params.toString().replaceAll("+", "%20")}`
}

/** "header-strafakte.png", like the files of scripts/case-header. */
export function pngFileName(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
  return `header-${slug || "akte"}.png`
}
