import { useRef, useState, type ComponentProps, type PointerEvent, type ReactElement, type ReactNode } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/**
 * A tooltip on `children` (one element that takes a ref, e.g. a button). Used instead of the
 * native `title`. Without a `label` the element is returned as it is.
 */
export function Hint({
  label,
  side,
  children,
}: {
  label: ReactNode
  side?: ComponentProps<typeof TooltipContent>["side"]
  children: ReactElement
}) {
  const [open, setOpen] = useState(false)
  // Menu and popover triggers prevent the pointerdown that would close the tooltip, and get the
  // focus back when their menu closes. So a press closes it here and keeps it closed until the
  // pointer comes back after the menu is gone.
  const pressed = useRef(false)
  const release = (e: PointerEvent<HTMLElement>) => {
    if (e.currentTarget.getAttribute("aria-expanded") !== "true") pressed.current = false
  }
  if (!label) return children
  return (
    <Tooltip open={open} onOpenChange={(next) => setOpen(next && !pressed.current)}>
      <TooltipTrigger
        asChild
        onPointerDownCapture={() => {
          pressed.current = true
          setOpen(false)
        }}
        onPointerEnter={release}
        onPointerLeave={release}
        onFocus={(e) => {
          if (pressed.current) e.preventDefault()
        }}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}
