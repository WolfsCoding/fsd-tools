import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { SpellingMenu as Menu } from "@/contracts/desktop"
import { desktop } from "@/lib/desktop"

const ITEM =
  "flex w-full cursor-pointer items-center rounded-md px-1.5 py-1 text-left text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground"

/**
 * The desktop shell's right-click menu on a misspelled word, in the look of the app's menus.
 * It never takes the focus: the shell replaces the word at the cursor of the focused field.
 */
export function SpellingMenu() {
  const [menu, setMenu] = useState<Menu | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => desktop?.spelling.subscribe(setMenu), [])

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const events = ["pointerdown", "keydown", "wheel", "resize", "blur"] as const
    for (const event of events) window.addEventListener(event, close)
    return () => {
      for (const event of events) window.removeEventListener(event, close)
    }
  }, [menu])

  // Opens towards the inside of the window near its edges, like a native menu.
  useLayoutEffect(() => {
    const el = ref.current
    if (!menu || !el) return
    const { width, height } = el.getBoundingClientRect()
    el.style.left = `${menu.x + width > innerWidth ? Math.max(0, menu.x - width) : menu.x}px`
    el.style.top = `${menu.y + height > innerHeight ? Math.max(0, menu.y - height) : menu.y}px`
  }, [menu])

  if (!menu) return null

  const pick = (action: () => void) => {
    action()
    setMenu(null)
  }

  return createPortal(
    <div
      ref={ref}
      role="menu"
      // Radix dialogs make the body inert to the pointer and close on a press outside them.
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.preventDefault()}
      className="pointer-events-auto fixed z-50 max-w-80 min-w-36 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 animate-in fade-in-0 zoom-in-95"
    >
      {menu.suggestions.length === 0 ? (
        <div className="px-1.5 py-1 text-sm text-muted-foreground">Keine Vorschläge</div>
      ) : (
        menu.suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            role="menuitem"
            className={ITEM}
            onClick={() => pick(() => desktop?.spelling.replace(suggestion))}
          >
            {suggestion}
          </button>
        ))
      )}
      <div className="-mx-1 my-1 h-px bg-border" />
      <button
        type="button"
        role="menuitem"
        className={ITEM}
        onClick={() => pick(() => desktop?.spelling.addToDictionary(menu.word))}
      >
        „{menu.word}“ zum Wörterbuch hinzufügen
      </button>
    </div>,
    document.body,
  )
}
