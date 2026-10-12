import type { ComponentProps, ReactElement, ReactNode } from "react"
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
  if (!label) return children
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}
