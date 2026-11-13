import { useEffect, useRef, useState } from "react"
import { PanelRightCloseIcon, PanelRightOpenIcon, SendHorizontalIcon, XIcon } from "lucide-react"
import { cn } from "cn"
import { Hint } from "@/components/hint"
import { Button } from "@/components/ui/button"
import { useMediaQuery } from "@/hooks/use-media-query"
import { removedToast } from "@/lib/undo"
import { insertAt } from "./rows"
import type { Operation } from "./types"

const time = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" })

/** Notes written down during the operation, like a chat with oneself. */
export function InfoPanel({ operation, onChange }: { operation: Operation; onChange: (fn: (o: Operation) => Operation) => void }) {
  const [draft, setDraft] = useState("")
  const listRef = useRef<HTMLOListElement>(null)
  const infos = operation.infos
  const wide = useMediaQuery("(min-width: 1024px)")
  /** Folded or unfolded by hand; until then, open where there is room. */
  const [folded, setFolded] = useState<boolean>()
  const collapsed = folded ?? !wide

  // Keeps the newest info in view, like a chat.
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [infos.length, collapsed])

  function send() {
    const text = draft.trim()
    if (!text) return
    onChange((o) => ({ ...o, infos: [...o.infos, { id: crypto.randomUUID(), text, at: new Date().toISOString() }] }))
    setDraft("")
  }

  function remove(i: number) {
    const info = infos[i]
    onChange((o) => ({ ...o, infos: o.infos.filter((x) => x.id !== info.id) }))
    removedToast("Info", () => onChange((o) => ({ ...o, infos: insertAt(o.infos, i, info) })))
  }

  return (
    // Folding narrows the panel to its toggle; the content stays anchored right, so it slides out like a drawer.
    <aside
      aria-label="Infos"
      className={cn(
        "relative shrink-0 overflow-hidden border-l transition-[width] duration-300 ease-out-quint motion-reduce:transition-none",
        collapsed ? "w-12" : "w-80",
      )}
    >
      <div className="absolute inset-y-0 right-0 flex w-80 flex-col">
        <div className={cn("flex items-center justify-between border-b py-2 pr-2 pl-4 transition-colors", collapsed && "border-transparent")}>
          <h2 className={cn("text-sm font-semibold transition-opacity", collapsed && "opacity-0")}>Infos</h2>
          <Hint label={collapsed ? "Infos einblenden" : "Infos ausblenden"} side="left">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={collapsed ? "Infos einblenden" : "Infos ausblenden"}
              aria-expanded={!collapsed}
              onClick={() => setFolded(!collapsed)}
            >
              {collapsed ? <PanelRightOpenIcon /> : <PanelRightCloseIcon />}
            </Button>
          </Hint>
        </div>
        <div inert={collapsed} className={cn("flex min-h-0 flex-1 flex-col transition-opacity duration-200", collapsed && "opacity-0")}>
          <ol ref={listRef} className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto p-3">
            {infos.length === 0 && <li className="px-1 py-6 text-center text-sm text-muted-foreground">Noch keine Infos</li>}
            {infos.map((info, i) => (
              <li key={info.id} className="group/info relative grid gap-1 rounded-lg bg-muted/60 px-3 py-2 pr-8">
                <p className="text-sm break-words whitespace-pre-wrap">{info.text}</p>
                <time dateTime={info.at} className="text-[11px] text-muted-foreground tabular-nums">
                  {time.format(new Date(info.at))}
                </time>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label="Info löschen"
                  className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover/info:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100"
                >
                  <XIcon className="size-3.5" />
                </button>
              </li>
            ))}
          </ol>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
            className="flex items-end gap-2 border-t p-3"
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  send()
                }
              }}
              rows={1}
              placeholder="Info schreiben…"
              aria-label="Neue Info"
              className="field-sizing-content max-h-40 min-h-9 flex-1 resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Senden">
              <SendHorizontalIcon />
            </Button>
          </form>
        </div>
      </div>
    </aside>
  )
}
