import type { MouseEvent } from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination"
import { pageCount, pageItems } from "@/lib/pagination"

interface DataPaginationProps {
  /** Number of items after filtering. */
  total: number
  /** 1-based page index. */
  page: number
  pageSize: number
  onPageChange: (page: number) => void
}

/** Pagination bar with range info. Always rendered, even when empty. */
export function DataPagination({
  total,
  page,
  pageSize,
  onPageChange,
}: DataPaginationProps) {
  const pages = pageCount(total, pageSize)
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  // The shadcn links are anchors; `href="#"` keeps them focusable but must not
  // change the URL, so navigation is handled here instead.
  function go(target: number) {
    return (e: MouseEvent) => {
      e.preventDefault()
      if (target >= 1 && target <= pages && target !== page) onPageChange(target)
    }
  }

  const disabledClass = "pointer-events-none opacity-50"

  return (
    <div className="flex shrink-0 items-center justify-between gap-4 text-sm">
      <p className="text-muted-foreground tabular-nums">
        {from}–{to} von {total}
      </p>

      <Pagination className="mx-0 w-auto" aria-label="Seitennavigation">
        <PaginationContent>
          <PaginationItem>
            <PaginationLink
              href="#"
              aria-label="Vorherige Seite"
              aria-disabled={page <= 1}
              className={page <= 1 ? disabledClass : undefined}
              onClick={go(page - 1)}
            >
              <ChevronLeftIcon />
            </PaginationLink>
          </PaginationItem>
          {pageItems(page, pages).map((item, i) =>
            item === "…" ? (
              <PaginationItem key={`ellipsis-${i}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={item}>
                <PaginationLink
                  href="#"
                  isActive={item === page}
                  aria-label={`Seite ${item}`}
                  onClick={go(item)}
                >
                  {item}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationLink
              href="#"
              aria-label="Nächste Seite"
              aria-disabled={page >= pages}
              className={page >= pages ? disabledClass : undefined}
              onClick={go(page + 1)}
            >
              <ChevronRightIcon />
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
