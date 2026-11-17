import { useMemo } from "react"
import { useNavigate } from "react-router"
import { useAtomValue } from "@effect/atom-react"
import { CalculatorIcon, FileTextIcon, ListIcon, ScaleIcon, UserIcon } from "lucide-react"
import { aktenzeichen } from "@/features/case-files/case-types"
import { casePath } from "@/features/case-files/kind"
import { POLICE_FILES_KIND } from "@/features/case-files/police-files"
import { caseFileTitle, useOwnName } from "@/features/case-files/use-case-files"
import { DNA_DB_BASE, personPath } from "@/features/dna-db/paths"
import { dnaEntriesAtom, entryName } from "@/features/dna-db/use-dna-entries"
import { books } from "@/features/law-book/data/books"
import { calculatorPath, catalogPath, LAW_BOOK_BASE, lawBookPath } from "@/features/law-book/paths"
import { useRegisterCommands, type CommandGroupDef } from "@/hooks/use-command-palette"
import { useEnabledFeatures } from "@/hooks/use-settings"

/**
 * What the palette finds from every page: the paragraphs of the Gesetzbuch, the Akten and
 * the Personen. Pages only add the commands that need their own state.
 */
export function GlobalCommands() {
  const navigate = useNavigate()
  const { enabledFeatures } = useEnabledFeatures()
  const enabled = (base: string) => enabledFeatures.some((f) => `/${f.path}` === base)
  const withLaws = enabled(LAW_BOOK_BASE)
  const withCaseFiles = enabled(POLICE_FILES_KIND.base)
  const withPersons = enabled(DNA_DB_BASE)

  const me = useOwnName()
  const caseFiles = useAtomValue(POLICE_FILES_KIND.atom)
  // One line per case file: typing changes the case files on every key, but this only when a
  // title changes, so the palette doesn't register its commands again each time.
  const listedFiles = withCaseFiles
    ? caseFiles.map((a) => [a.id, caseFileTitle(a, me, POLICE_FILES_KIND.templates), aktenzeichen(a)].join("\t")).join("\n")
    : ""

  const entries = useAtomValue(dnaEntriesAtom)
  const listedPersons = withPersons
    ? entries
        .map((e) => [e.id, entryName(e), e.dnaId, e.fingerprintId, ...(e.tags ?? []).map((t) => t.name)].join("\t"))
        .sort((a, b) => a.split("\t")[1].localeCompare(b.split("\t")[1], "de"))
        .join("\n")
    : ""

  const groups = useMemo<CommandGroupDef[]>(
    () => [
      {
        heading: "Gesetzbuch",
        actionLabel: "Paragraph öffnen",
        items: withLaws
          ? [
              {
                id: "law-book:catalog",
                label: "Strafkatalog",
                keywords: ["Strafmaß", "Geldstrafe", "Bußgeld", "Criminal Offenses", "Ticket Offenses"],
                icon: ListIcon,
                onSelect: () => navigate(catalogPath()),
              },
              {
                id: "law-book:calculator",
                label: "Strafrechner",
                keywords: ["Straftaten", "Strafmaß", "Geldstrafe", "Rechner", "Summe"],
                icon: CalculatorIcon,
                onSelect: () => navigate(calculatorPath()),
              },
              ...books.flatMap((book) =>
                book.chapters.flatMap((chapter) =>
                  chapter.paragraphs.map((p) => ({
                    id: `law-book:${book.id}:${p.number}`,
                    label: `§ ${p.number} ${book.abbreviation} ${p.title}`,
                    keywords: [book.title, chapter.title],
                    icon: ScaleIcon,
                    hint: book.abbreviation,
                    onSelect: () => navigate(lawBookPath(book.id, p.number)),
                  })),
                ),
              ),
            ]
          : [],
      },
      {
        heading: `Alle ${POLICE_FILES_KIND.title}`,
        actionLabel: `${POLICE_FILES_KIND.noun} öffnen`,
        items: (listedFiles ? listedFiles.split("\n") : []).map((line) => {
          const [id, label, number] = line.split("\t")
          return {
            id: `${POLICE_FILES_KIND.id}:${id}`,
            label,
            keywords: number ? [number] : [],
            icon: FileTextIcon,
            onSelect: () => navigate(casePath(POLICE_FILES_KIND, id)),
          }
        }),
      },
      {
        heading: "Alle Personen",
        actionLabel: "Person öffnen",
        items: (listedPersons ? listedPersons.split("\n") : []).map((line) => {
          const [id, label, dnaId, ...keywords] = line.split("\t")
          return {
            id: `dna-db:entry:${id}`,
            label,
            keywords: [dnaId, ...keywords].filter(Boolean),
            icon: UserIcon,
            hint: dnaId || undefined,
            onSelect: () => navigate(personPath(id)),
          }
        }),
      },
    ],
    [withLaws, listedFiles, listedPersons, navigate],
  )
  useRegisterCommands("global", groups)

  return null
}
