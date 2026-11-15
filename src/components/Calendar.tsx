import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import {
  addMonths,
  buildMonthGrid,
  isSameDay,
  parseISODate,
  startOfMonth,
  toISODate,
} from '@/components/calendarUtils'
import { cn } from '@/components/cn'

export type CalendarProps = {
  /** Selected day as `YYYY-MM-DD`. */
  value?: string
  onChange?: (isoDate: string) => void
  /** Minimum selectable day `YYYY-MM-DD`. */
  min?: string
  /** Maximum selectable day `YYYY-MM-DD`. */
  max?: string
  /** Month shown initially / when uncontrolled. */
  defaultMonth?: string
  className?: string
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const monthNameFormat = new Intl.DateTimeFormat('en-US', { month: 'long' })
const MONTH_NAMES = Array.from({ length: 12 }, (_, index) =>
  monthNameFormat.format(new Date(2000, index, 1)),
)

/** Years offered when `min`/`max` don't bound the list. */
const YEAR_SPREAD = 10

type Menu = 'month' | 'year'

type OptionItem = {
  key: string
  label: string
  selected: boolean
  disabled: boolean
  onSelect: () => void
}

/** Select-style dropdown used by the month and year pickers in the header. */
function HeaderMenu({
  label,
  items,
  width,
  onClose,
}: {
  label: string
  items: OptionItem[]
  width: string
  onClose: () => void
}) {
  const listRef = useRef<HTMLUListElement>(null)

  // Start on the current value so the list scrolls to it.
  useEffect(() => {
    const selected = listRef.current?.querySelector<HTMLButtonElement>(
      'button[aria-selected="true"]:not(:disabled)',
    )
    const fallback = listRef.current?.querySelector<HTMLButtonElement>(
      'button[role="option"]:not(:disabled)',
    )
    ;(selected ?? fallback)?.focus()
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const options = [
      ...(listRef.current?.querySelectorAll<HTMLButtonElement>(
        'button[role="option"]:not(:disabled)',
      ) ?? []),
    ]
    const current = options.indexOf(document.activeElement as HTMLButtonElement)
    const step = event.key === 'ArrowDown' ? 1 : -1
    const next = options[(current + step + options.length) % options.length]
    next?.focus()
  }

  return (
    <ul
      ref={listRef}
      role="listbox"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        'absolute top-full left-1/2 z-30 mt-1 max-h-60 -translate-x-1/2 overflow-auto border border-line/20 bg-ink py-1',
        width,
      )}
    >
      {items.map((item) => (
        <li key={item.key} role="none">
          <button
            type="button"
            role="option"
            aria-selected={item.selected}
            disabled={item.disabled}
            className={cn(
              'flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition disabled:opacity-40',
              item.selected ? 'text-ball' : 'text-mist hover:bg-line/5 hover:text-line',
            )}
            onClick={() => {
              item.onSelect()
              onClose()
            }}
          >
            <span className="truncate">{item.label}</span>
            {item.selected ? (
              <span aria-hidden className="text-ball">
                ✓
              </span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  )
}

export function Calendar({
  value,
  onChange,
  min,
  max,
  defaultMonth,
  className,
}: CalendarProps) {
  const selected = value ? parseISODate(value) : null
  const minDate = min ? parseISODate(min) : null
  const maxDate = max ? parseISODate(max) : null

  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(
      selected ?? (defaultMonth ? parseISODate(defaultMonth) : new Date()),
    ),
  )

  const days = useMemo(() => buildMonthGrid(visibleMonth), [visibleMonth])
  const [todayIso] = useState(() => toISODate(new Date()))

  const visibleYear = visibleMonth.getFullYear()
  const visibleMonthIndex = visibleMonth.getMonth()

  // Month/year pickers: reaching a distant date shouldn't take dozens of clicks.
  const [menu, setMenu] = useState<Menu | null>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const monthButtonRef = useRef<HTMLButtonElement>(null)
  const yearButtonRef = useRef<HTMLButtonElement>(null)

  const closeMenu = (restoreFocus = true) => {
    if (restoreFocus) {
      const trigger = menu === 'year' ? yearButtonRef : monthButtonRef
      trigger.current?.focus()
    }
    setMenu(null)
  }

  useEffect(() => {
    if (!menu) return
    const onPointerDown = (event: MouseEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setMenu(null)
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation() // close the menu, not the dialog around the calendar
      const trigger = menu === 'year' ? yearButtonRef : monthButtonRef
      trigger.current?.focus()
      setMenu(null)
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [menu])

  /** A month is out of reach when none of its days can be picked. */
  const monthOutOfRange = (year: number, monthIndex: number) => {
    const first = new Date(year, monthIndex, 1)
    const last = new Date(year, monthIndex + 1, 0)
    return Boolean((minDate && last < minDate) || (maxDate && first > maxDate))
  }

  const firstMonthInRange = (year: number) =>
    MONTH_NAMES.findIndex((_, index) => !monthOutOfRange(year, index))

  // Offered years: bounded by min/max when given, else a spread around today.
  const baseYear = Number(todayIso.slice(0, 4))
  const firstYear = Math.min(
    minDate?.getFullYear() ?? baseYear - YEAR_SPREAD,
    visibleYear,
  )
  const lastYear = Math.max(maxDate?.getFullYear() ?? baseYear + YEAR_SPREAD, visibleYear)
  const years = useMemo(
    () =>
      Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index),
    [firstYear, lastYear],
  )

  const triggerClass =
    'border border-line/20 px-2 py-1 text-sm font-medium tracking-wide uppercase transition hover:border-ball hover:text-ball focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ball/30'

  return (
    <div className={cn('w-full max-w-sm border border-line/20 bg-ink/40 p-4', className)}>
      <div ref={headerRef} className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous month"
          className="border border-line/20 px-2 py-1 text-sm text-mist transition hover:border-ball hover:text-ball"
          onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
        >
          ‹
        </button>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              ref={monthButtonRef}
              type="button"
              aria-haspopup="listbox"
              aria-expanded={menu === 'month'}
              aria-label={`Month: ${MONTH_NAMES[visibleMonthIndex]}`}
              className={cn(triggerClass, 'text-line')}
              onClick={() => setMenu((current) => (current === 'month' ? null : 'month'))}
            >
              {MONTH_NAMES[visibleMonthIndex]}
            </button>
            {menu === 'month' ? (
              <HeaderMenu
                label="Month"
                width="w-40"
                onClose={closeMenu}
                items={MONTH_NAMES.map((name, index) => ({
                  key: name,
                  label: name,
                  selected: index === visibleMonthIndex,
                  disabled: monthOutOfRange(visibleYear, index),
                  onSelect: () => setVisibleMonth(new Date(visibleYear, index, 1)),
                }))}
              />
            ) : null}
          </div>

          <div className="relative">
            <button
              ref={yearButtonRef}
              type="button"
              aria-haspopup="listbox"
              aria-expanded={menu === 'year'}
              aria-label={`Year: ${visibleYear}`}
              className={cn(triggerClass, 'text-line')}
              onClick={() => setMenu((current) => (current === 'year' ? null : 'year'))}
            >
              {visibleYear}
            </button>
            {menu === 'year' ? (
              <HeaderMenu
                label="Year"
                width="w-28"
                onClose={closeMenu}
                items={years.map((year) => ({
                  key: String(year),
                  label: String(year),
                  selected: year === visibleYear,
                  disabled: firstMonthInRange(year) === -1,
                  onSelect: () => {
                    // Keep the month when it exists in that year, else the first in range.
                    const month = monthOutOfRange(year, visibleMonthIndex)
                      ? firstMonthInRange(year)
                      : visibleMonthIndex
                    setVisibleMonth(new Date(year, Math.max(month, 0), 1))
                  },
                }))}
              />
            ) : null}
          </div>
        </div>

        <button
          type="button"
          aria-label="Next month"
          className="border border-line/20 px-2 py-1 text-sm text-mist transition hover:border-ball hover:text-ball"
          onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-fog">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const iso = toISODate(day)
          const inMonth = day.getMonth() === visibleMonth.getMonth()
          const isSelected = selected ? isSameDay(day, selected) : false
          const isToday = iso === todayIso
          const tooEarly = minDate ? day < minDate : false
          const tooLate = maxDate ? day > maxDate : false
          const disabled = tooEarly || tooLate

          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              aria-label={iso}
              aria-pressed={isSelected}
              onClick={() => onChange?.(iso)}
              className={cn(
                'aspect-square text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ball/30',
                !inMonth && 'text-fog/50',
                inMonth && !isSelected && 'text-mist hover:bg-line/5 hover:text-line',
                isToday && !isSelected && 'border border-line/25',
                isSelected && 'bg-ball text-ink',
                disabled && 'cursor-not-allowed opacity-30 hover:bg-transparent',
              )}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
