import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination"
import { pageItems } from "@/lib/pagination"

/** Pages of a note: previous/next and page numbers. */
export function NotePagination({
  page,
  pages,
  onPageChange,
  className,
}: {
  /** 1-based page index. */
  page: number
  pages: number
  onPageChange: (page: number) => void
  className?: string
}) {
  return (
    <Pagination aria-label="Seiten der Notiz" className={cn("w-auto", className)}>
      <PaginationContent>
        <PaginationItem>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Vorherige Seite"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeftIcon />
          </Button>
        </PaginationItem>
        {pageItems(page, pages).map((item, i) =>
          item === "…" ? (
            <PaginationItem key={`ellipsis-${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <Button
                variant={item === page ? "outline" : "ghost"}
                size="icon"
                className="tabular-nums"
                aria-label={`Seite ${item}`}
                aria-current={item === page ? "page" : undefined}
                onClick={() => onPageChange(item)}
              >
                {item}
              </Button>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Nächste Seite"
            disabled={page >= pages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRightIcon />
          </Button>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
