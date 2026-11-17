import { cn } from "cn"
import { money } from "./order"

/** An amount, with digits of equal width so columns of them line up. */
export function Price({ value, className }: { value: number; className?: string }) {
  return <span className={cn("whitespace-nowrap tabular-nums", className)}>{money(value)}</span>
}
