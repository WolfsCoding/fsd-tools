import { MenuIcon } from "lucide-react"
import { useSidebar } from "@/components/ui/sidebar"

/** Opens the navigation sheet on phones. */
export function MainMenu() {
  const { setOpenMobile } = useSidebar()
  return (
    <button
      type="button"
      aria-label="Menü"
      onClick={() => setOpenMobile(true)}
      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-strip-foreground outline-none hover:bg-strip-hover focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-5"
    >
      <MenuIcon />
    </button>
  )
}
