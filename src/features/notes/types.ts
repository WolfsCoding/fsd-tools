/** A note in Markdown/HTML, on its own or about a person. */
export interface Note {
  id: string
  title: string
  content: string
  /** Rank and name of who wrote it, from the settings. */
  author?: string
  createdAt: string
  updatedAt: string
}
