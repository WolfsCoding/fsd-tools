import type { ComponentType, ReactNode } from "react"
import { BookOpenIcon, DnaIcon, FileCodeIcon, FolderOpenIcon, NotebookPenIcon, ScaleIcon, SirenIcon, UserIcon } from "lucide-react"
import { CaseFilesPage } from "./case-files/case-files-page"
import { CaseFilesSettings, MarkdownSettings, OwnPersonSettings, SnippetsSettings } from "./case-files/case-files-settings"
import { POLICE_FILES_BASE } from "./case-files/paths"
import { isValidPoliceFilesData, LEGACY_FORENSICS_KEY, POLICE_FILES_KEY } from "./case-files/police-files"
import { SNIPPETS_KEY } from "./case-files/snippets"
import { COLORS_KEY, DEPARTMENT_KEY, ME_KEY, ME_RANK_KEY } from "./case-files/use-case-files"
import { DnaDbPage } from "./dna-db/dna-db-page"
import { DnaDbSettings } from "./dna-db/dna-db-settings"
import { DNA_DB_BASE } from "./dna-db/paths"
import { DNA_DISMISSED_KEY, DNA_ENTRIES_KEY, isValidDnaData } from "./dna-db/use-dna-entries"
import { OperationsPage } from "./operations/operations-page"
import { OperationsSettings } from "./operations/operations-settings"
import { OPERATIONS_BASE } from "./operations/paths"
import { OPERATIONS_KEY, isValidOperationsData } from "./operations/use-operations"
import { FsuPage } from "./fsu/fsu-page"
import { LawBookPage } from "./law-book/law-book-page"
import { BOOKMARKS_KEY } from "./law-book/bookmarks"
import { CALCULATOR_KEY } from "./law-book/charge-calculator"
import { LAW_BOOK_BASE } from "./law-book/paths"
import { FSU_BASE } from "./fsu/paths"
import { NotesPage } from "./notes/notes-page"
import { NotesSettings } from "./notes/notes-settings"
import { NOTES_BASE } from "./notes/paths"
import { isValidNotesData, LEGACY_PAGES_KEY, NOTES_KEY } from "./notes/use-notes"

export interface Feature {
  /** URL path segment, e.g. "dna-db" → /dna-db */
  path: string
  title: string
  description?: string
  icon: ComponentType<{ className?: string }>
  element: ReactNode
  /** localStorage keys owned by this feature; enables export/import/clear in its settings. */
  storage?: {
    keys: string[]
    /** Rejects imports whose data doesn't fit this feature. */
    validate?: (data: Record<string, unknown>) => boolean
  }
  /** Extra rows shown in the "Daten" section of the feature's settings page. */
  settings?: ComponentType
  /** Own settings sections built with SettingsSection, shown above "Daten". */
  preferences?: ComponentType
}

/**
 * Every tool in the app. Adding an entry here registers its route, its
 * sidebar entry, and its settings page — no other wiring needed.
 */
export const features: Feature[] = [
  {
    path: DNA_DB_BASE.slice(1),
    title: "DNA-DB",
    description: "Durchsuchbare Datenbank für DNA- und Fingerabdruck-IDs",
    icon: DnaIcon,
    element: <DnaDbPage />,
    storage: { keys: [DNA_ENTRIES_KEY, DNA_DISMISSED_KEY], validate: isValidDnaData },
    settings: DnaDbSettings,
  },
  {
    path: FSU_BASE.slice(1),
    title: "FSU-Erklärungen",
    description: "Beiträge, die Abläufe wie DNA-Extraktion, BTM-Analysen oder Fingerabdrucksicherung erklären",
    icon: BookOpenIcon,
    element: <FsuPage />,
  },
  {
    path: LAW_BOOK_BASE.slice(1),
    title: "Gesetzbuch",
    description: "Criminal Offenses, Ticket Offenses, Law und Civil Procedures durchsuchen, mit Strafrahmen je Absatz",
    icon: ScaleIcon,
    element: <LawBookPage />,
    storage: {
      keys: [BOOKMARKS_KEY, CALCULATOR_KEY],
      // Both are read leniently; only reject what isn't a list.
      validate: (data) => Object.values(data).every(Array.isArray),
    },
  },
  {
    path: NOTES_BASE.slice(1),
    title: "Notizen",
    description: "Einfache Textnotizen auf DIN-A4-Seiten",
    icon: NotebookPenIcon,
    element: <NotesPage />,
    storage: { keys: [NOTES_KEY, LEGACY_PAGES_KEY], validate: isValidNotesData },
    settings: NotesSettings,
  },
  {
    path: OPERATIONS_BASE.slice(1),
    title: "Einsatzleitung",
    description: "Einsatzleiter-Blatt: Streifen, Status, Aufgaben, Verlauf und Notizen für größere Einsätze",
    icon: SirenIcon,
    element: <OperationsPage />,
    storage: { keys: [OPERATIONS_KEY], validate: isValidOperationsData },
    settings: OperationsSettings,
  },
  {
    path: POLICE_FILES_BASE.slice(1),
    title: "Akten",
    description: "Strafakten, Sammelakten, Aussagen, Messungen und forensische Analysen ausfüllen und als Markdown kopieren",
    icon: FolderOpenIcon,
    element: <CaseFilesPage />,
    storage: { keys: [POLICE_FILES_KEY, LEGACY_FORENSICS_KEY, ME_KEY, ME_RANK_KEY, DEPARTMENT_KEY, COLORS_KEY, SNIPPETS_KEY], validate: isValidPoliceFilesData },
    settings: CaseFilesSettings,
    preferences: SnippetsSettings,
  },
]

/** A settings page of its own, apart from the features. */
export interface SettingsPage {
  /** Identifies the page in the settings dialog; must not collide with a feature's path. */
  id: string
  title: string
  description?: string
  icon: ComponentType<{ className?: string }>
  /** The page's sections, built with `SettingsSection`. */
  content: ComponentType
}

/** Settings shared by several features, listed above the features in the settings dialog. */
export const settingsPages: SettingsPage[] = [
  {
    id: "eigene-person",
    title: "Eigene Person",
    description: "Rang, Name und Department für Akten und Analysen",
    icon: UserIcon,
    content: OwnPersonSettings,
  },
  {
    id: "markdown",
    title: "Markdown",
    description: "Farben des kopierten Markdowns der Akten und Analysen",
    icon: FileCodeIcon,
    content: MarkdownSettings,
  },
]
