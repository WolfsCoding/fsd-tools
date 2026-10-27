import { useEffect, useRef, useState, type DragEvent } from "react"
import { cn } from "cn"
import { PinIcon, PinOffIcon, PlusIcon, XIcon } from "lucide-react"
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
import { TAB_DRAG_TYPE, useTabs, type Tab } from "@/hooks/use-tabs"

type DropTarget = { id: string; side: "before" | "after" }

/**
 * Tabs in the title bar like Windows 11's File Explorer: the active one is joined to
 * the toolbar below, the others sit flat on the frame. The free space drags the
 * window in a desktop shell.
 */
export function TabBar() {
  const { tabs, activeId, openInNewTab, titleOf, move } = useTabs()
  const { enabledFeatures } = useEnabledFeatures()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const activeIndex = tabs.findIndex((t) => t.id === activeId)

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
    // The right padding keeps clear of the window buttons in the desktop shell.
    <div className="flex h-11 shrink-0 items-end bg-titlebar pr-[calc(100vw-env(titlebar-area-x,0px)-env(titlebar-area-width,100vw))] pl-1 app-drag md:pl-0">
      {/* Desktop has the menu on the tool strip. */}
      <div className="self-center app-no-drag md:hidden">
        <MainMenu />
      </div>
      <div
        ref={scrollRef}
        role="tablist"
        aria-label="Offene Tabs"
        // Vertical wheel scrolls the strip sideways.
        onWheel={(e) => {
          if (scrollRef.current && e.deltaY) {
            scrollRef.current.scrollLeft += e.deltaY
          }
        }}
        // px-2 leaves room for the active tab's flares.
        className="flex h-full min-w-0 items-end no-scrollbar overflow-x-auto px-2 app-no-drag"
      >
        {tabs.map((tab, i) => (
          <TabItem
            key={tab.id}
            tab={tab}
            active={i === activeIndex}
            dragging={tab.id === dragId}
            dropSide={dropTarget?.id === tab.id ? dropTarget.side : undefined}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move"
              e.dataTransfer.setData("text/plain", titleOf(tab))
              e.dataTransfer.setData(TAB_DRAG_TYPE, tab.id)
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
          <DropdownMenuTrigger
            aria-label="Neuer Tab"
            // Small like the tabs' close button and centered on the tabs' height.
            className="mb-1 ml-0.5 flex h-6 w-7 shrink-0 items-center justify-center rounded-md text-strip-foreground outline-none app-no-drag transition-[background-color,scale] hover:bg-strip-hover active:scale-90 focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-strip-hover [&_svg]:size-3.5"
          >
            <PlusIcon />
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
    titleOfPath,
    featureOf,
    activeId,
    openSplit,
    closeSplit,
    splitWith,
    unsplit,
    swapSplit,
  } = useTabs()
  const feature = featureOf(tab.path)
  const splitFeature = tab.split ? featureOf(tab.split) : undefined
  const title = titleOf(tab)
  const index = tabs.indexOf(tab)
  const hasUnpinned = tabs.some((t) => !t.pinned)
  const tooltip =
    (feature && feature.title !== title ? `${feature.title} › ${title}` : title) +
    (tab.split ? ` | ${titleOfPath(tab.split)}` : "")

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
              // Opened tabs rise out of the frame; hover fades like the IDE's.
              "group relative flex h-8 min-w-28 shrink cursor-pointer items-center gap-2 rounded-t-lg pr-1 pl-3 text-xs text-foreground outline-none select-none animate-in duration-200 ease-out-quint fade-in-0 slide-in-from-bottom-2 transition-[background-color,opacity] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              active
                ? "z-10 bg-tab-active font-semibold tab-flares"
                : "hover:bg-tab-hover",
              // A split view fits both titles instead of the fixed width.
              tab.split ? "max-w-[30rem]" : "w-60",
              dragging && "opacity-50",
            )}
          >
            {feature && <feature.icon className="size-4 shrink-0" />}
            <span className="truncate">{title}</span>
            {tab.split && (
              <>
                <span aria-hidden className="h-4 w-px shrink-0 bg-foreground/20" />
                {splitFeature && <splitFeature.icon className="size-4 shrink-0" />}
                <span className="truncate">{titleOfPath(tab.split)}</span>
              </>
            )}
            <button
              type="button"
              tabIndex={-1}
              aria-label={tab.pinned ? "Tab lösen" : "Tab schließen"}
              onClick={(e) => {
                e.stopPropagation()
                if (tab.pinned) togglePin(tab.id)
                else closeTabs(tab.id)
              }}
              className="ml-auto flex size-6 shrink-0 items-center justify-center rounded-sm text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground [&_svg]:size-3.5"
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
                  "absolute top-1 bottom-2 w-0.5 rounded-full bg-primary animate-in duration-150 fade-in-0",
                  dropSide === "before" ? "-left-px" : "-right-px",
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
        <ContextMenuSeparator />
        {active ? (
          tab.split ? (
            <>
              <ContextMenuItem onSelect={swapSplit}>Seiten tauschen</ContextMenuItem>
              <ContextMenuItem onSelect={unsplit}>In zwei Tabs auflösen</ContextMenuItem>
              <ContextMenuItem onSelect={closeSplit}>Split View schließen</ContextMenuItem>
            </>
          ) : (
            <ContextMenuItem onSelect={() => openSplit()}>Split View öffnen</ContextMenuItem>
          )
        ) : (
          // Merges this tab into the active one, like dropping it on the right half.
          <ContextMenuItem disabled={!activeId} onSelect={() => splitWith(tab.id, "right")}>
            Rechts neben aktivem Tab öffnen
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem disabled={!canReopen} onSelect={reopenClosed}>
          Geschlossenen Tab wiederherstellen
          <ContextMenuShortcut>Alt ⇧ T</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
