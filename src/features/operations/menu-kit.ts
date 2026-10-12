import {
  ContextMenuCheckboxItem,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * The parts of a menu, so one list of items can fill both the "⋯" dropdown of a row and
 * its right-click menu.
 */
export interface MenuKit {
  Item: typeof DropdownMenuItem
  CheckboxItem: typeof DropdownMenuCheckboxItem
  RadioGroup: typeof DropdownMenuRadioGroup
  RadioItem: typeof DropdownMenuRadioItem
  Label: typeof DropdownMenuLabel
  Separator: typeof DropdownMenuSeparator
  Sub: typeof DropdownMenuSub
  SubTrigger: typeof DropdownMenuSubTrigger
  SubContent: typeof DropdownMenuSubContent
}

export const DROPDOWN_KIT: MenuKit = {
  Item: DropdownMenuItem,
  CheckboxItem: DropdownMenuCheckboxItem,
  RadioGroup: DropdownMenuRadioGroup,
  RadioItem: DropdownMenuRadioItem,
  Label: DropdownMenuLabel,
  Separator: DropdownMenuSeparator,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
}

export const CONTEXT_KIT: MenuKit = {
  Item: ContextMenuItem,
  CheckboxItem: ContextMenuCheckboxItem,
  RadioGroup: ContextMenuRadioGroup,
  RadioItem: ContextMenuRadioItem,
  Label: ContextMenuLabel,
  Separator: ContextMenuSeparator,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
}
