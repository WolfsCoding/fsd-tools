import type { TaskPriority } from "./types"

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  normal: "Normal",
  hoch: "Hoch",
  dringend: "Dringend",
}

// Literal class names so Tailwind picks them up. Normal tasks get no badge.
export const TASK_PRIORITY_BADGE: Record<TaskPriority, string> = {
  normal: "",
  hoch: "bg-amber-500/15 text-amber-300",
  dringend: "bg-red-500/20 text-red-300",
}
