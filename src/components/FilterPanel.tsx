import { useId, useState, type ReactNode } from 'react'

import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { cn } from '@/components/cn'

export type FilterPanelProps = {
  /** Panel heading (also the region's accessible name). */
  title?: string
  /** Active filters; shows a count badge and a "Clear filters" action when > 0. */
  activeCount: number
  onClear: () => void
  /**
   * Force the panel open on small screens (e.g. a filter has an error the
   * user has to see to fix). Disables the Show/Hide toggle meanwhile.
   */
  forceOpen?: boolean
  children: ReactNode
  className?: string
}

/**
 * Frame for a page's filters: heading, active count, "Clear filters", and a
 * Show/Hide toggle that collapses the controls below `sm` so results stay
 * above the fold. From `sm` up the controls are always shown.
 */
export function FilterPanel({
  title = 'Filters',
  activeCount,
  onClear,
  forceOpen = false,
  children,
  className,
}: FilterPanelProps) {
  const titleId = useId()
  const bodyId = useId()
  const [expanded, setExpanded] = useState(false)
  const open = expanded || forceOpen

  return (
    <section
      aria-labelledby={titleId}
      className={cn('space-y-5 border border-line/15 bg-ink/20 p-4 sm:p-5', className)}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2
            id={titleId}
            className="text-sm font-medium tracking-wide text-line uppercase"
          >
            {title}
          </h2>
          {activeCount > 0 ? (
            <Badge tone="accent" aria-label={`${activeCount} active`}>
              {activeCount}
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={onClear}>
              Clear filters
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="sm:hidden"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setExpanded(!open)}
            disabled={forceOpen}
          >
            {open ? 'Hide' : 'Show'}
          </Button>
        </div>
      </div>

      <div id={bodyId} className={cn('space-y-5 sm:block', open ? 'block' : 'hidden')}>
        {children}
      </div>
    </section>
  )
}
