import { banner, bullets, code, doc, facts, formatLocalDateTime, section, DATE_UHR } from "@/features/case-files/markdown"
import type { Colors } from "@/features/case-files/markdown"
import { headerImage } from "@/features/case-files/templates"
import type { PlateCheck } from "./types"

const PLATE_BANNER = headerImage("Gefälschtes Kennzeichen")

/** The ticket for a fake plate (§ 22 Abs. 1 TO), in the layout of the Speedingticket. */
export function renderPlateTicket(check: PlateCheck, colors: Colors) {
  const text = (s: string) => s.trim() || "N/A"
  const when = `${formatLocalDateTime(check.date, DATE_UHR)} Uhr`
  return (
    doc(
      banner(PLATE_BANNER),
      facts([
        ["DATUM & UHRZEIT", when],
        ["TATORT", text(check.scene)],
      ]),
      section(
        { colors },
        "1. Ergebnis:",
        bullets([
          `Der BES ${code(text(check.driver))} fuhr am ${code(when)} in ${code(text(check.scene))} mit einem ${code(text(check.model))} des Halters ${code(text(check.holder ?? ""))} mit dem Kennzeichen ${code(text(check.plate))}`,
          "Eine Überprüfung des Kennzeichens ergab, dass dieses nicht amtlich ausgegeben und somit gefälscht ist",
        ]),
      ),
    ) + "\n\n---"
  )
}
