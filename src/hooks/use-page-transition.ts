import { useLayoutEffect, type RefObject } from "react"
import { useLocation } from "react-router"

/**
 * Eases the page in whenever the route's path changes. Animates the element in place
 * instead of remounting it, so the page keeps its state; search params don't count,
 * as pages keep their search and open tab there.
 */
export function usePageTransition(ref: RefObject<HTMLElement | null>) {
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return
    ref.current?.animate(
      [
        { opacity: 0, transform: "translateY(6px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    )
  }, [pathname, ref])
}
