import { CarFrontIcon, CheckIcon, HeadsetIcon, ShirtIcon, ZapIcon, type LucideIcon } from "lucide-react"
import type { MemberState } from "./types"

export const MEMBER_STATE_LABEL: Record<MemberState, string> = {
  verfuegbar: "Verfügbar",
  leitstelle: "Leitstelle",
  beifahrer: "Beifahrer",
  zivil: "Zivil",
  sondereinsatz: "Sondereinsatz",
}

export const MEMBER_STATE_ICON: Record<MemberState, LucideIcon> = {
  verfuegbar: CheckIcon,
  leitstelle: HeadsetIcon,
  beifahrer: CarFrontIcon,
  zivil: ShirtIcon,
  sondereinsatz: ZapIcon,
}
