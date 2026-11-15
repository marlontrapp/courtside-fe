import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

import { Calendar } from '@/components/Calendar'
import { parseISODate, toISODate } from '@/components/calendarUtils'
import { cn } from '@/components/cn'

export type DatePickerProps = {
  id?: string
  label: string
  /** Selected day `YYYY-MM-DD`, or `''` for none. */
  value: string
  onChange: (isoDate: string) => void
  /** Earliest selectable day `YYYY-MM-DD`. */
  min?: string
  /** Latest selectable day `YYYY-MM-DD`. */
  max?: string
  /** Month to open on when there's no value (`YYYY-MM-DD`; defaults to `min`, then today). */
  defaultMonth?: string
  /** Shown when no day is selected. */
  placeholder?: string
  /** Keep a way to clear the selection (default true). */
  clearable?: boolean
  /** How the selected day reads in the trigger. */
  formatValue?: (isoDate: string) => string
  error?: ReactNode
  hint?: ReactNode
  disabled?: boolean
  className?: string
}

const defaultFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function formatDefault(isoDate: string): string {
  const date = parseISODate(isoDate)
  return Number.isNaN(date.getTime()) ? isoDate : defaultFormat.format(date)
}

/**
 * Select-style trigger that opens the Courtside `Calendar` in a dropdown —
 * the compact way to pick a day inside forms and filter panels. Use
 * `DateField` when the calendar should stay visible inline.
 */
export function DatePicker({
  id,
  label,
  value,
  onChange,
  min,
  max,
  defaultMonth,
  placeholder = 'Pick a date',
  clearable = true,
  formatValue = formatDefault,
  error,
  hint,
  disabled = false,
  className,
}: DatePickerProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const popoverId = `${fieldId}-calendar`
  const errorId = `${fieldId}-error`
  const hintId = `${fieldId}-hint`

  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  const close = ({ restoreFocus }: { restoreFocus: boolean }) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Move focus into the calendar: the selected day, else today, else the first day
  // that can be picked. (Calendar day buttons are labelled with their ISO date.)
  useEffect(() => {
    if (!open) return
    const popover = popoverRef.current
    const day = (selector: string) =>
      popover?.querySelector<HTMLButtonElement>(`button${selector}:not(:disabled)`)
    const target =
      day('[aria-pressed="true"]') ??
      day(`[aria-label="${toISODate(new Date())}"]`) ??
      day('[aria-pressed]')
    target?.focus()
  }, [open])

  const describedBy = error ? errorId : hint ? hintId : undefined

  return (
    <div className={cn('space-y-2', className)} ref={rootRef}>
      <label htmlFor={fieldId} className="block text-sm font-medium text-mist">
        {label}
      </label>

      <div className="relative">
        <button
          ref={triggerRef}
          id={fieldId}
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? popoverId : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onClick={() => setOpen((current) => !current)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && !open) {
              event.preventDefault()
              setOpen(true)
            }
          }}
          className={cn(
            'w-full border border-line/20 bg-ink/40 py-3 pr-24 pl-4 text-left outline-none transition focus:border-ball/70 focus:ring-2 focus:ring-ball/30 disabled:opacity-60',
            error ? 'border-clay/50 focus:border-clay/70 focus:ring-clay/20' : null,
            value ? 'text-line' : 'text-fog',
          )}
        >
          <span className="block truncate">
            {value ? formatValue(value) : placeholder}
          </span>
        </button>
        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-2">
          {clearable && value ? (
            <button
              type="button"
              aria-label={`Clear ${label}`}
              disabled={disabled}
              className="pointer-events-auto text-xs tracking-wide text-fog uppercase transition hover:text-ball disabled:opacity-60"
              onClick={() => {
                onChange('')
                close({ restoreFocus: true })
              }}
            >
              Clear
            </button>
          ) : null}
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="h-4 w-4 shrink-0 text-fog"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
          >
            <rect x="2.5" y="3.5" width="11" height="10" />
            <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
          </svg>
        </div>

        {open ? (
          <div
            ref={popoverRef}
            id={popoverId}
            role="dialog"
            aria-label={label}
            className="absolute z-30 mt-1 w-full max-w-sm min-w-[17rem] bg-ink"
          >
            <Calendar
              value={value || undefined}
              min={min}
              max={max}
              defaultMonth={defaultMonth ?? min}
              onChange={(isoDate) => {
                onChange(isoDate)
                close({ restoreFocus: true })
              }}
            />
          </div>
        ) : null}
      </div>

      {error ? (
        <p id={errorId} className="text-sm text-clay">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm text-fog">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
