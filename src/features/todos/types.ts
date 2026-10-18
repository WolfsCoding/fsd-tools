/** Something to do, optionally about Akten and persons of the DNA-DB. Apart from the to-dos inside the Akten. */
export interface Todo {
  id: string
  title: string
  /** Details from older versions; no longer shown or edited. */
  note?: string
  done: boolean
  /** Ids of the Akten it is about. */
  caseFileIds?: string[]
  /** Ids of the DNA-DB entries it is about. */
  personIds?: string[]
  /** Rank and name of who created it, from the settings. */
  author?: string
  createdAt: string
  /** When it was ticked off. */
  doneAt?: string
}

export type TodoInput = Pick<Todo, "title" | "caseFileIds" | "personIds">
