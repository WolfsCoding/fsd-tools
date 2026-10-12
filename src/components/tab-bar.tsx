import { useEffect, useRef, useState, type DragEvent } from "react"
import { cn } from "cn"
import {
  PinIcon,
  PinOffIcon,
  PlusIcon,
  XIcon,
} from "lucide-react"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Hint } from "@/components/hint"
import { MainMenu } from "@/components/main-menu"
import { useEnabledFeatures } from "@/hooks/use-settings"
import { useTabs, type Tab } from "@/hooks/use-tabs"

type DropTarget = { id: string; side: "before" | "after" }

const ICON_BUTTON =
  "flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-tab-hover hover:text-foreground focus-visible:bg-tab-hover"

/** WebStorm-like editor tabs in their own island above the side panel and page. */
export function TabBar() {
  const { tabs, activeId, openInNewTab, titleOf, move } =
    useTabs()
  const { enabledFeatures } = useEnabledFeatures()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)

  useEffect(() => {
    scrollRef.current
      ?.querySelector<HTMLElement>(`[data-tab-id="${activeId}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [activeId, tabs.length])

  function onDragOver(e: DragEvent<HTMLElement>, id: string) {
    if (!dragId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    const rect = e.currentTarget.getBoundingClientRect()
    const side = e.clientX < rect.left + rect.width / 2 ? "before" : "after"
    if (dropTarget?.id !== id || dropTarget.side !== side) {
      setDropTarget({ id, side })
    }
  }

  function endDrag() {
    setDragId(null)
    setDropTarget(null)
  }

  return (
    <div className="flex h-11 shrink-0 items-center gap-1 rounded-xl bg-island px-1.5">
      {/* Desktop has the menu on the tool strip. */}
      <div className="md:hidden">
        <MainMenu />
      </div>
      <div
        ref={scrollRef}
        role="tablist"
        aria-label="Offene Tabs"
        // Vertical wheel scrolls the strip sideways, like in the IDE.
        onWheel={(e) => {
          if (scrollRef.current && e.deltaY) {
            scrollRef.current.scrollLeft += e.deltaY
          }
        }}
        className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none]"
      >
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            active={tab.id === activeId}
            dragging={tab.id === dragId}
            dropSide={dropTarget?.id === tab.id ? dropTarget.side : undefined}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move"
              e.dataTransfer.setData("text/plain", titleOf(tab))
              setDragId(tab.id)
            }}
            onDragOver={(e) => onDragOver(e, tab.id)}
            onDrop={(e) => {
              e.preventDefault()
              if (dragId && dropTarget) move(dragId, dropTarget.id, dropTarget.side)
              endDrag()
            }}
            onDragEnd={endDrag}
          />
        ))}
      </div>
      <DropdownMenu>
        <Hint label="Neuer Tab">
          <DropdownMenuTrigger aria-label="Neuer Tab" className={ICON_BUTTON}>
            <PlusIcon className="size-4" />
          </DropdownMenuTrigger>
        </Hint>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuLabel>In neuem Tab öffnen</DropdownMenuLabel>
          {enabledFeatures.map((f) => (
            <DropdownMenuItem
              key={f.path}
              onSelect={() => openInNewTab(`/${f.path}`)}
            >
              <f.icon />
              <span className="truncate">{f.title}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function TabItem({
  tab,
  active,
  dragging,
  dropSide,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  tab: Tab
  active: boolean
  dragging: boolean
  dropSide?: "before" | "after"
  onDragStart: (e: DragEvent<HTMLElement>) => void
  onDragOver: (e: DragEvent<HTMLElement>) => void
  onDrop: (e: DragEvent<HTMLElement>) => void
  onDragEnd: () => void
}) {
  const {
    tabs,
    activate,
    closeTabs,
    togglePin,
    duplicate,
    reopenClosed,
    canReopen,
    titleOf,
    featureOf,
  } = useTabs()
  const feature = featureOf(tab.path)
  const title = titleOf(tab)
  const index = tabs.indexOf(tab)
  const hasUnpinned = tabs.some((t) => !t.pinned)
  const tooltip =
    feature && feature.title !== title ? `${feature.title} › ${title}` : title

  return (
    <ContextMenu>
      <Hint label={tooltip}>
        <ContextMenuTrigger asChild>
          <div
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            data-tab-id={tab.id}
            data-active={active}
            draggable
            onClick={() => activate(tab.id)}
            // Middle click closes; preventing mousedown stops Windows' autoscroll.
            onMouseDown={(e) => e.button === 1 && e.preventDefault()}
            onAuxClick={(e) => {
              if (e.button !== 1) return
              e.preventDefault()
              closeTabs(tab.id)
            }}
            onKeyDown={(e) => {
              if (e.key === "Delete") closeTabs(tab.id)
            }}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            className={cn(
              "group relative flex h-7 max-w-56 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-transparent pr-1 pl-2 text-[13px] text-foreground/80 outline-none select-none hover:bg-tab-hover hover:text-foreground focus-visible:border-ring",
              active &&
                "border-tab-active-border bg-tab-active text-foreground hover:bg-tab-active",
              dragging && "opacity-50",
            )}
          >
            {feature && <feature.icon className="size-3.5 shrink-0" />}
            <span className="truncate">{title}</span>
            <button
              type="button"
              tabIndex={-1}
              aria-label={tab.pinned ? "Tab lösen" : "Tab schließen"}
              onClick={(e) => {
                e.stopPropagation()
                if (tab.pinned) togglePin(tab.id)
                else closeTabs(tab.id)
              }}
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-foreground/10 hover:text-foreground [&_svg]:size-3.5",
                !tab.pinned && !active && "opacity-0 group-hover:opacity-100",
              )}
            >
              {tab.pinned ? (
                <>
                  <PinIcon className="group-hover:hidden" />
                  <PinOffIcon className="hidden group-hover:block" />
                </>
              ) : (
                <XIcon />
              )}
            </button>
            {dropSide && (
              <span
                className={cn(
                  "absolute inset-y-1 w-0.5 rounded-full bg-primary",
                  // Centered in the gap-1 between tabs.
                  dropSide === "before" ? "-left-[3.5px]" : "-right-[3.5px]",
                )}
              />
            )}
          </div>
        </ContextMenuTrigger>
      </Hint>
      <ContextMenuContent className="w-60">
        <ContextMenuItem onSelect={() => closeTabs(tab.id)}>
          Schließen
          {active && <ContextMenuShortcut>Alt W</ContextMenuShortcut>}
        </ContextMenuItem>
        <ContextMenuItem
          disabled={tabs.length < 2}
          onSelect={() => closeTabs(tab.id, "others")}
        >
          Andere Tabs schließen
        </ContextMenuItem>
        <ContextMenuItem
          disabled={index === 0}
          onSelect={() => closeTabs(tab.id, "left")}
        >
          Tabs links schließen
        </ContextMenuItem>
        <ContextMenuItem
          disabled={index === tabs.length - 1}
          onSelect={() => closeTabs(tab.id, "right")}
        >
          Tabs rechts schließen
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!hasUnpinned}
          onSelect={() => closeTabs(tab.id, "unpinned")}
        >
          Alle außer angehefteten schließen
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => closeTabs(tab.id, "all")}>
          Alle Tabs schließen
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => togglePin(tab.id)}>
          {tab.pinned ? "Tab lösen" : "Tab anheften"}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => duplicate(tab.id)}>
          Tab duplizieren
        </ContextMenuItem>
        <ContextMenuItem disabled={!canReopen} onSelect={reopenClosed}>
          Geschlossenen Tab wiederherstellen
          <ContextMenuShortcut>Alt ⇧ T</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
