import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PAGE_SIZE_OPTIONS, type PageSize } from '@/constants/pagination'

export type { PageSize }

interface DataTablePaginationProps {
  page: number
  limit: PageSize
  total: number
  pageSizeOptions?: PageSize[]
  onPageChange: (page: number) => void
  onLimitChange: (limit: PageSize) => void
}

// Windowed page numbers: always show first/last and a small run around the
// current page, collapsing everything else into a single ellipsis.
function getPageNumbers(current: number, totalPages: number): (number | 'ellipsis')[] {
  const keep = new Set([1, totalPages, current - 1, current, current + 1])
  const sorted = [...keep].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)

  const result: (number | 'ellipsis')[] = []
  let previous = 0
  for (const p of sorted) {
    if (previous && p - previous > 1) result.push('ellipsis')
    result.push(p)
    previous = p
  }
  return result
}

export function DataTablePagination({
  page,
  limit,
  total,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  onPageChange,
  onLimitChange,
}: DataTablePaginationProps) {
  const totalPages = limit === 'all' ? 1 : Math.max(1, Math.ceil(total / limit))
  const pageNumbers = getPageNumbers(page, totalPages)

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="text-muted-foreground text-sm">
        {total === 0
          ? 'No results'
          : limit === 'all'
            ? `Showing all ${total}`
            : `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}`}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Rows per page</span>
          <Select
            value={String(limit)}
            onValueChange={(value) => onLimitChange(value === 'all' ? 'all' : Number(value))}
          >
            <SelectTrigger className="w-18">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size === 'all' ? 'All' : size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
            Previous
          </Button>
          {pageNumbers.map((p, index) =>
            p === 'ellipsis' ? (
              <span key={`ellipsis-${index}`} className="text-muted-foreground px-2 text-sm">
                …
              </span>
            ) : (
              <Button
                key={p}
                variant={p === page ? 'default' : 'outline'}
                size="sm"
                className="w-8"
                onClick={() => onPageChange(p)}
              >
                {p}
              </Button>
            )
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
