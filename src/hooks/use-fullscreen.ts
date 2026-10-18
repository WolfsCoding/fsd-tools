import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react"

/**
 * "Vollbild" for `ref`'s element. Switching it grows the element from where it was to
 * full screen, or shrinks it back, instead of jumping.
 */
export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [fullscreen, setState] = useState(false)
  const current = useRef(fullscreen)
  // Where the element was just before the switch; measured then, as the DOM is still old.
  const from = useRef<DOMRect | null>(null)

  const setFullscreen = useCallback(
    (on: boolean) => {
      // Esc can ask twice; the second ask would measure mid-animation.
      if (on === current.current) return
      from.current = ref.current?.getBoundingClientRect() ?? null
      setState(on)
    },
    [ref],
  )

  useLayoutEffect(() => {
    current.current = fullscreen
    const el = ref.current
    const rect = from.current
    from.current = null
    // A closing dialog plays its own exit animation.
    if (el && rect && el.dataset.state !== "closed") resize(el, rect)
  }, [fullscreen, ref])

  return [fullscreen, setFullscreen] as const
}

const EASING = "cubic-bezier(0.22, 1, 0.36, 1)"

/**
 * Animates `el`'s box from `from` to where it is now. A fixed element moves and resizes
 * (so its text reflows instead of stretching); one back in the page, where its containers
 * may clip it, fades in place instead.
 */
function resize(el: HTMLElement, from: DOMRect) {
  // A `duration-*` without a transition property transitions everything, e.g. the
  // dialog's top and left; finished, so the element is measured where it ends up.
  for (const a of el.getAnimations()) {
    if (a instanceof CSSTransition) a.finish()
  }
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return
  if (getComputedStyle(el).position !== "fixed") {
    el.animate([{ opacity: 0, transform: "scale(0.98)" }, { opacity: 1, transform: "none" }], {
      duration: 200,
      easing: EASING,
    })
    return
  }
  const to = el.getBoundingClientRect()
  const box = (r: DOMRect) => ({
    top: `${r.top}px`,
    left: `${r.left}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    translate: "none",
    maxWidth: "none",
    maxHeight: "none",
    // The content is laid out for the end already; clipped until the box gets there.
    overflow: "hidden",
  })
  el.animate([box(from), box(to)], { duration: 300, easing: EASING })
}
