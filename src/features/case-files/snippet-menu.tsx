import { Settings2Icon, TextQuoteIcon } from "lucide-react"
import { Hint } from "@/components/hint"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSettingsDialog } from "@/hooks/use-settings"
import { POLICE_FILES_BASE } from "./paths"
import { snippetLabel, useSnippets } from "./snippets"

/** Settings page of the Akten, where the snippets are managed. */
const SETTINGS_PAGE = POLICE_FILES_BASE.slice(1)

/**
 * "Textbaustein einfügen": picks one of the own snippets for `onInsert`. Shows nothing while
 * there are none; they're added in the settings.
 */
export function SnippetMenu({ onInsert }: { onInsert: (text: string) => void }) {
  const { snippets } = useSnippets()
  const { openPage } = useSettingsDialog()
  if (!snippets.length) return null
  return (
    <DropdownMenu>
      <Hint label="Textbaustein einfügen">
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Textbaustein einfügen"
            className="flex h-6 items-center gap-1 self-center rounded-md px-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
          >
            <TextQuoteIcon className="size-3.5" /> Textbaustein
          </button>
        </DropdownMenuTrigger>
      </Hint>
      {/* The point the snippet went into keeps the focus, not the button. */}
      <DropdownMenuContent align="end" className="w-64" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DropdownMenuLabel>Textbaustein einfügen</DropdownMenuLabel>
        {snippets.map((s) => (
          <DropdownMenuItem key={s.id} onSelect={() => onInsert(s.text)} disabled={!s.text.trim()}>
            <span className="truncate">{snippetLabel(s)}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => openPage(SETTINGS_PAGE)}>
          <Settings2Icon /> Textbausteine verwalten…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
