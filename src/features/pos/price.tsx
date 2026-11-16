import { cn } from "cn"
import { money } from "./order"

/** An amount, set as inline code. */
export function Price({ value, className }: { value: number; className?: string }) {
  return <code className={cn("rounded-md bg-muted px-1.5 py-0.5 font-mono whitespace-nowrap", className)}>{money(value)}</code>
}
