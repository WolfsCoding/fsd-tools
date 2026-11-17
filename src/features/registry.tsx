import type { ComponentType, ReactNode } from "react"
import { BookOpenIcon, CarIcon, DnaIcon, DonutIcon, FolderOpenIcon, ImageIcon, NotebookPenIcon, ReceiptIcon, ScaleIcon, SirenIcon, UserIcon, UsersIcon, UtensilsIcon, WorkflowIcon } from "lucide-react"
import type { StoredEntry } from "@/lib/storage"
import { CaseFilesPage } from "./case-files/case-files-page"
import { CaseFilesSummary, OwnPersonSettings } from "./case-files/case-files-settings"
import { POLICE_FILES_BASE } from "./case-files/paths"
import { legacyForensicsAtom, policeFilesAtom } from "./case-files/police-files"
import { snippetsAtom } from "./case-files/snippets"
import { colorsAtom, departmentAtom, ownNameAtom, ownRankAtom } from "./case-files/use-case-files"
import { cyberStepsAtom, itemStepsAtom } from "./forensics/step-templates"
import { CaseFilesPreferences } from "./forensics/step-templates-settings"
import { DnaDbPage } from "./dna-db/dna-db-page"
import { DnaDbSummary } from "./dna-db/dna-db-settings"
import { DNA_DB_BASE } from "./dna-db/paths"
import { dnaDismissedAtom, dnaEntriesAtom } from "./dna-db/use-dna-entries"
import { DonutsPage } from "./donuts/donuts-page"
import { DONUTS_BASE } from "./donuts/paths"
import { OperationsPage } from "./operations/operations-page"
import { OPERATIONS_BASE } from "./operations/paths"
import { operationsAtom } from "./operations/use-operations"
import { rosterUnitsAtom } from "./operations/roster"
import { officersAtom } from "./officers/officers"
import { OfficersSettings } from "./officers/officers-settings"
import "./officers/seed"
import { RosterSettings } from "./operations/roster-settings"
import { FlowchartsPage } from "./flowcharts/flowcharts-page"
import { FlowchartsSummary } from "./flowcharts/flowcharts-settings"
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
import { NotesSummary } from "./notes/notes-settings"
import { NOTES_BASE } from "./notes/paths"
import { foldersAtom } from "./notes/folders"
import { legacyPagesAtom, notesAtom } from "./notes/use-notes"
import { catalogAtom, historyAtom, orderAtom } from "./pos/order"
import { POS_BASE } from "./pos/paths"
import { PosPage } from "./pos/pos-page"
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
   * The stored atoms this feature owns; enables export/import/clear in the settings. Imports
   * are checked against each atom's schema.
   */
  storage?: {
    entries: StoredEntry[]
  }
  /** Renders what is stored as short text, e.g. "12 Akten", next to the feature's data in the settings. */
  summary?: ComponentType
  /** A generator or side tool; the tool strip sets these apart from the police work, after a divider. */
  extra?: boolean
}

/**
 * Every tool in the app, in the order the tool strip, the start screen and the menus show
 * them: the police work first, then the extras. Adding an entry here registers its route,
 * its sidebar entry, its switch and its data in the settings — no other wiring needed.
 */
export const features: Feature[] = [
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
        officersAtom,
        colorsAtom,
        snippetsAtom,
        cyberStepsAtom,
        itemStepsAtom,
      ],
    },
    summary: CaseFilesSummary,
  },
  {
    path: DNA_DB_BASE.slice(1),
    title: "Personen",
    description: "Durchsuchbare Datenbank für Personen, DNA- und Fingerabdruck-IDs",
    icon: DnaIcon,
    element: <DnaDbPage />,
    storage: { entries: [dnaEntriesAtom, dnaDismissedAtom] },
    summary: DnaDbSummary,
  },
  {
    path: OPERATIONS_BASE.slice(1),
    title: "Einsatzleitung",
    description: "Streifenblatt, beteiligte Fahrzeuge und Personen, Funk und Infos für größere Einsätze; daraus eine Sammelakte erstellen",
    icon: SirenIcon,
    element: <OperationsPage />,
    storage: { entries: [operationsAtom, rosterUnitsAtom] },
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
    path: PLATES_BASE.slice(1),
    title: "Kennzeichen abfragen",
    description: "Gesehene Kennzeichen mit Fahrer, Fahrzeug, Datum und Tatort; nicht angemeldete als Ticket kopieren",
    icon: CarIcon,
    element: <PlatesPage />,
    storage: { entries: [platesAtom] },
  },
  {
    path: NOTES_BASE.slice(1),
    title: "Notizen",
    description: "Notizen aus Blöcken wie Abschnitten, Listen und Tabellen, in Ordnern sortiert",
    icon: NotebookPenIcon,
    element: <NotesPage />,
    storage: { entries: [notesAtom, foldersAtom, legacyPagesAtom] },
    summary: NotesSummary,
  },
  {
    path: FSU_BASE.slice(1),
    title: "FSU-Erklärungen",
    description: "Beiträge, die Abläufe wie DNA-Extraktion, BTM-Analysen oder Fingerabdrucksicherung erklären",
    icon: BookOpenIcon,
    element: <FsuPage />,
  },
  {
    path: FLOWCHARTS_BASE.slice(1),
    title: "Ablaufdiagramme",
    description: "Abläufe mit Verzweigungen bauen und als PNG zum Posten exportieren",
    icon: WorkflowIcon,
    element: <FlowchartsPage />,
    storage: { entries: [flowchartsAtom] },
    summary: FlowchartsSummary,
    extra: true,
  },
  {
    path: HEADERS_BASE.slice(1),
    title: "Header-Bilder",
    description: "Header für Akten mit Titel, Untertitel und Logo gestalten und als PNG exportieren",
    icon: ImageIcon,
    element: <HeadersPage />,
    storage: { entries: [headerDesignAtom, headerScaleAtom] },
    extra: true,
  },
  {
    path: RECEIPTS_BASE.slice(1),
    title: "Kassenbon",
    description: "Kassenbons zum Spaß gestalten, mit Artikeln, Summe und Rückgeld, und als PNG exportieren",
    icon: ReceiptIcon,
    element: <ReceiptsPage />,
    storage: { entries: [receiptAtom, receiptScaleAtom] },
    extra: true,
  },
  {
    path: POS_BASE.slice(1),
    title: "Kasse",
    description: "Restaurant-Kasse: Artikel und Menüs antippen, je Person mit Notizen bestellen und zusammen oder einzeln abrechnen",
    icon: UtensilsIcon,
    element: <PosPage />,
    storage: { entries: [catalogAtom, orderAtom, historyAtom] },
    extra: true,
  },
  {
    path: DONUTS_BASE.slice(1),
    title: "Donut-Rechner",
    description: "Preis für Donuts ausrechnen, oder wie viele man für einen Betrag bekommt: 10 Stück für 75 $, einzeln 8 $",
    icon: DonutIcon,
    element: <DonutsPage />,
    extra: true,
  },
]

/** The groups of the settings navigation, in their order. */
export const SETTINGS_GROUPS = ["Profil", "Vorlagen", "App"] as const

export interface SettingsPage {
  /** Identifies the page in the settings dialog. */
  id: string
  group: (typeof SETTINGS_GROUPS)[number]
  title: string
  description?: string
  icon: ComponentType<{ className?: string }>
  /** The page's sections, built with `SettingsSection`. */
  content: ComponentType
  /** Further terms the settings search finds the page by. */
  keywords?: string[]
}

/** The settings pages of the features; the dialog adds those of the app itself. */
export const settingsPages: SettingsPage[] = [
  {
    id: "eigene-person",
    group: "Profil",
    title: "Eigene Person",
    description: "Rang, Name und Department für Akten und Analysen",
    icon: UserIcon,
    content: OwnPersonSettings,
  },
  {
    id: "officer",
    group: "Profil",
    title: "Officer",
    description: "Officer, die in Akten und in der Einsatzleitung vorgeschlagen werden",
    icon: UsersIcon,
    content: OfficersSettings,
    keywords: ["kollegen"],
  },
  {
    id: POLICE_FILES_BASE.slice(1),
    group: "Vorlagen",
    title: "Akten",
    description: "Textbausteine, Vorlagen der Analysen und Farben des kopierten Markdowns",
    icon: FolderOpenIcon,
    content: CaseFilesPreferences,
    keywords: ["textbaustein", "vorlage", "markdown", "farbe", "cyberforensisch", "forensisch", "untersuchung"],
  },
  {
    id: OPERATIONS_BASE.slice(1),
    group: "Vorlagen",
    title: "Einsatzleitung",
    description: "Fahrzeuge und Kennungen, die das Streifenblatt vorschlägt",
    icon: SirenIcon,
    content: RosterSettings,
    keywords: ["fahrzeug", "kennung", "streifenblatt", "einheit"],
  },
]
