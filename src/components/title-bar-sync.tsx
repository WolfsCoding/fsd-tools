import { useEffect } from "react"
import { desktop } from "@/lib/desktop"

// The Windows buttons are drawn by the desktop shell, outside the page, so a dialog's
// overlay can't dim or blur them. Instead their colors follow the tab bar and are
// darkened like the overlay darkens it while one is open.

/** How much each overlay darkens what's under it, as in components/ui (bg-black/…). */
const OVERLAYS: Record<string, { light: number; dark: number }> = {
  "dialog-overlay": { light: 0.2, dark: 0.4 },
  "alert-dialog-overlay": { light: 0.2, dark: 0.4 },
  "sheet-overlay": { light: 0.1, dark: 0.1 },
}

const SELECTOR = Object.keys(OVERLAYS)
  .map((slot) => `[data-slot="${slot}"]:not([data-state="closed"])`)
  .join(",")

/** `#rrggbb` mixed with black by `amount` (0–1); other colors stay as they are. */
function darken(hex: string, amount: number) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex.trim()
  const n = parseInt(m[1], 16)
  return (
    "#" +
    [16, 8, 0]
      .map((shift) => Math.round(((n >> shift) & 0xff) * (1 - amount)))
      .map((c) => c.toString(16).padStart(2, "0"))
      .join("")
  )
}

function titleBarColors() {
  const root = document.documentElement
  const style = getComputedStyle(root)
  const theme = root.classList.contains("dark") ? "dark" : "light"
  const overlays = [...document.querySelectorAll(SELECTOR)].map((el) => OVERLAYS[el.getAttribute("data-slot")!][theme])
  // Stacked overlays (a dialog over a dialog) darken each other.
  const amount = 1 - overlays.reduce((left, a) => left * (1 - a), 1)
  return {
    color: darken(style.getPropertyValue("--titlebar"), amount),
    symbolColor: darken(style.getPropertyValue("--strip-foreground"), amount),
  }
}

/** Keeps the desktop shell's Windows buttons in the colors of the tab bar and any open overlay. */
export function TitleBarSync() {
  useEffect(() => {
    if (!desktop) return
    let last = ""
    const sync = () => {
      const colors = titleBarColors()
      const key = `${colors.color} ${colors.symbolColor}`
      if (key === last) return
      last = key
      desktop!.setTitleBar(colors)
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "data-state"],
    })
    return () => observer.disconnect()
  }, [])

  return null
}
