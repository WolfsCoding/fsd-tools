import { useRef, type ReactNode } from "react"
import {
  ClipboardCopyIcon,
  FileTextIcon,
  FingerprintIcon,
  FolderIcon,
  PencilIcon,
  TagsIcon,
  TextCursorInputIcon,
  Trash2Icon,
  UserIcon,
} from "lucide-react"
import { useNavigate } from "react-router"
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { caseFilePath } from "@/features/case-files/paths"
import { copy } from "@/lib/clipboard"
import type { CaseFileMention } from "./case-file-mentions"
import { TagDot } from "./tag-badge"
import { sameTag } from "./tags"
import type { DnaEntry, DnaTag } from "./types"

/** Menu around an entry row: right click, the context menu key or Shift+F10. */
export function DnaEntryContextMenu({
  entry,
  knownTags,
  mentions,
  onOpenPerson,
  onEdit,
  onRename,
  onEditTags,
  onEditCaseNumbers,
  onSetTags,
  onDelete,
  children,
}: {
  entry: DnaEntry
  /** Tags used across all entries, offered as quick toggles. */
  knownTags: DnaTag[]
  /** The Akten that mention the entry, offered as links. */
  mentions: CaseFileMention[]
  /** Opens the page with everything known about the person. */
  onOpenPerson: () => void
  onEdit: () => void
  onRename: () => void
  onEditTags: () => void
  onEditCaseNumbers: () => void
  onSetTags: (tags: DnaTag[]) => void
  onDelete: () => void
  children: ReactNode
}) {
  const navigate = useNavigate()
  // Renaming focuses the name field; the menu must not take the focus back to the row.
  const renaming = useRef(false)
  const tags = entry.tags ?? []

  function toggle(tag: DnaTag, on: boolean) {
    onSetTags(on ? [...tags, tag] : tags.filter((t) => !sameTag(t.name, tag.name)))
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent
        className="w-60"
        onCloseAutoFocus={(e) => {
          if (renaming.current) e.preventDefault()
          renaming.current = false
        }}
      >
        <ContextMenuItem onSelect={onOpenPerson}>
          <UserIcon /> Personenansicht
        </ContextMenuItem>
        <ContextMenuItem onSelect={onEdit}>
          <PencilIcon /> Bearbeiten
          <ContextMenuShortcut>Enter</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            renaming.current = true
            onRename()
          }}
        >
          <TextCursorInputIcon /> Umbenennen
          <ContextMenuShortcut>F2</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <TagsIcon /> Tags
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="max-h-80 w-52 overflow-y-auto">
            {knownTags.map((tag) => (
              <ContextMenuCheckboxItem
                key={tag.name}
                checked={tags.some((t) => sameTag(t.name, tag.name))}
                onCheckedChange={(on) => toggle(tag, on)}
                // Stay open so several tags can be toggled in one go.
                onSelect={(e) => e.preventDefault()}
              >
                <TagDot color={tag.color} /> {tag.name}
              </ContextMenuCheckboxItem>
            ))}
            {knownTags.length > 0 && <ContextMenuSeparator />}
            <ContextMenuItem onSelect={onEditTags}>
              <TagsIcon /> Tags bearbeiten…
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem onSelect={onEditCaseNumbers}>
          <FolderIcon /> Aktennummern…
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger disabled={mentions.length === 0}>
            <FileTextIcon /> Erwähnt in Akten
            {mentions.length > 0 && <ContextMenuShortcut>{mentions.length}</ContextMenuShortcut>}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="max-h-80 w-64 overflow-y-auto">
            {mentions.map((m) => (
              <ContextMenuItem key={m.id} onSelect={() => navigate(caseFilePath(m.id))}>
                <FileTextIcon /> <span className="truncate">{m.title}</span>
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={!entry.dnaId} onSelect={() => copy(entry.dnaId, "DNA-ID")}>
          <ClipboardCopyIcon /> DNA-ID kopieren
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!entry.fingerprintId}
          onSelect={() => copy(entry.fingerprintId, "Fingerabdruck-ID")}
        >
          <FingerprintIcon /> Fingerabdruck-ID kopieren
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2Icon /> Löschen
          <ContextMenuShortcut>Entf</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
