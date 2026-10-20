/** A note in Markdown/HTML, on its own or about a person. */
export interface Note {
  id: string
  title: string
  content: string
  /** Rank and name of who wrote it, from the settings. */
  author?: string
  /** Folder it sits in under "Notizen"; missing means the top level. */
  folderId?: string
  /** Place among the notes and folders next to it, once dragged there. */
  order?: number
  createdAt: string
  updatedAt: string
}

/** A folder of notes, possibly inside another one. */
export interface NoteFolder {
  id: string
  name: string
  /** Folder it sits in; missing means the top level. */
  parentId?: string
  /** Place among the notes and folders next to it, once dragged there. */
  order?: number
  createdAt: string
  updatedAt: string
}
