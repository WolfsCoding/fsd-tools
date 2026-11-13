import type { ComponentType, ReactNode } from "react"
import { BookOpenIcon, CarIcon, DnaIcon, DonutIcon, FileCodeIcon, FolderOpenIcon, ImageIcon, NotebookPenIcon, ReceiptIcon, ScaleIcon, SirenIcon, UserIcon, WorkflowIcon } from "lucide-react"
import type { StoredEntry } from "@/lib/storage"
import { CaseFilesPage } from "./case-files/case-files-page"
import { CaseFilesSettings, MarkdownSettings, OwnPersonSettings } from "./case-files/case-files-settings"
import { POLICE_FILES_BASE } from "./case-files/paths"
import { legacyForensicsAtom, policeFilesAtom } from "./case-files/police-files"
import { snippetsAtom } from "./case-files/snippets"
import { colorsAtom, departmentAtom, ownNameAtom, ownRankAtom } from "./case-files/use-case-files"
import { cyberStepsAtom, itemStepsAtom } from "./forensics/step-templates"
import { CaseFilesPreferences } from "./forensics/step-templates-settings"
import { DnaDbPage } from "./dna-db/dna-db-page"
import { DnaDbSettings } from "./dna-db/dna-db-settings"
import { DNA_DB_BASE } from "./dna-db/paths"
import { dnaDismissedAtom, dnaEntriesAtom } from "./dna-db/use-dna-entries"
import { DonutsPage } from "./donuts/donuts-page"
import { DONUTS_BASE } from "./donuts/paths"
import { OperationsPage } from "./operations/operations-page"
import { OPERATIONS_BASE } from "./operations/paths"
import { operationsAtom } from "./operations/use-operations"
import { FlowchartsPage } from "./flowcharts/flowcharts-page"
import { FlowchartsSettings } from "./flowcharts/flowcharts-settings"
import { FLOWCHARTS_BASE } from "./flowcharts/paths"
import { flowchartsAtom } from "./flowcharts/use-flowcharts"
import { FsuPage } from "./fsu/fsu-page"
import { HeadersPage } from "./headers/headers-page"
import { headerDesignAtom, headerScaleAtom } from "./headers/storage"
import { HEADERS_BASE } from "./headers/paths"
import { LawBookPage } from "./law-book/law-book-page"
import { bookmarksAtom } from "./law-book/bookmarks"
import { calculatorAtom } from "./law-book/calculator"
import { LAW_BOOK_BASE } from "./law-book/paths"
import { FSU_BASE } from "./fsu/paths"
import { PLATES_BASE } from "./plates/paths"
import { PlatesPage } from "./plates/plates-page"
import { platesAtom } from "./plates/use-plates"
import { NotesPage } from "./notes/notes-page"
import { NotesSettings } from "./notes/notes-settings"
import { NOTES_BASE } from "./notes/paths"
import { foldersAtom } from "./notes/folders"
import { legacyPagesAtom, notesAtom } from "./notes/use-notes"
import { RECEIPTS_BASE } from "./receipts/paths"
import { ReceiptsPage } from "./receipts/receipts-page"
import { receiptAtom, receiptScaleAtom } from "./receipts/storage"

export interface Feature {
  /** URL path segment, e.g. "dna-db" → /dna-db */
  path: string
  title: string
  description?: string
  icon: ComponentType<{ className?: string }>
  element: ReactNode
  /**
   * The stored atoms this feature owns; enables export/import/clear in its settings. Imports
   * are checked against each atom's schema.
   */
  storage?: {
    entries: StoredEntry[]
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
    title: "Personen",
    description: "Durchsuchbare Datenbank für Personen, DNA- und Fingerabdruck-IDs",
    icon: DnaIcon,
    element: <DnaDbPage />,
    storage: { entries: [dnaEntriesAtom, dnaDismissedAtom] },
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
    storage: { entries: [bookmarksAtom, calculatorAtom] },
  },
  {
    path: NOTES_BASE.slice(1),
    title: "Notizen",
    description: "Notizen aus Blöcken, wie die zu Personen",
    icon: NotebookPenIcon,
    element: <NotesPage />,
    storage: { entries: [notesAtom, foldersAtom, legacyPagesAtom] },
    settings: NotesSettings,
  },
  {
    path: PLATES_BASE.slice(1),
    title: "Kennzeichen abfragen",
    description: "Gesehene Kennzeichen mit Fahrer, Fahrzeug, Datum und Tatort; nicht angemeldete als Ticket kopieren",
    icon: CarIcon,
    element: <PlatesPage />,
    storage: { entries: [platesAtom] },
  },
  {
    path: FLOWCHARTS_BASE.slice(1),
    title: "Ablaufdiagramme",
    description: "Abläufe mit Verzweigungen bauen und als PNG zum Posten exportieren",
    icon: WorkflowIcon,
    element: <FlowchartsPage />,
    storage: { entries: [flowchartsAtom] },
    settings: FlowchartsSettings,
  },
  {
    path: HEADERS_BASE.slice(1),
    title: "Header-Bilder",
    description: "Header für Akten mit Titel, Untertitel und Logo gestalten und als PNG exportieren",
    icon: ImageIcon,
    element: <HeadersPage />,
    storage: { entries: [headerDesignAtom, headerScaleAtom] },
  },
  {
    path: RECEIPTS_BASE.slice(1),
    title: "Kassenbon",
    description: "Just for fun: Kassenbons mit Artikeln, Summe und Rückgeld gestalten und als PNG exportieren",
    icon: ReceiptIcon,
    element: <ReceiptsPage />,
    storage: { entries: [receiptAtom, receiptScaleAtom] },
  },
  {
    path: DONUTS_BASE.slice(1),
    title: "Donut-Rechner",
    description: "Preis für Donuts ausrechnen, oder wie viele man für einen Betrag bekommt: 10 Stück für 75 $, einzeln 8 $",
    icon: DonutIcon,
    element: <DonutsPage />,
  },
  {
    path: OPERATIONS_BASE.slice(1),
    title: "Einsatzleitung",
    description: "Streifenblatt, beteiligte Fahrzeuge und Personen, Funk und Infos für größere Einsätze; daraus eine Sammelakte erstellen",
    icon: SirenIcon,
    element: <OperationsPage />,
    storage: { entries: [operationsAtom] },
  },
  {
    path: POLICE_FILES_BASE.slice(1),
    title: "Akten",
    description: "Strafakten, Sammelakten, Aussagen, Messungen und forensische Analysen ausfüllen und als Markdown kopieren",
    icon: FolderOpenIcon,
    element: <CaseFilesPage />,
    storage: {
      entries: [
        policeFilesAtom,
        legacyForensicsAtom,
        ownNameAtom,
        ownRankAtom,
        departmentAtom,
        colorsAtom,
        snippetsAtom,
        cyberStepsAtom,
        itemStepsAtom,
      ],
    },
    settings: CaseFilesSettings,
    preferences: CaseFilesPreferences,
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
