export interface Post {
  /** File name without `.md`, used in the URL. */
  id: string
  title: string
  category: string
  /** Sort position within the category; posts without one come after, by title. */
  order?: number
  /** Markdown body (without frontmatter). */
  content: string
}
