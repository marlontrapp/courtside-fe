import { useMemo, useState } from 'react'

import {
  addMonths,
  buildMonthGrid,
  isSameDay,
  monthLabel,
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

  return (
    <div className={cn('w-full max-w-sm border border-line/20 bg-ink/40 p-4', className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label="Previous month"
          className="border border-line/20 px-2 py-1 text-sm text-mist transition hover:border-ball hover:text-ball"
          onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
        >
          ‹
        </button>
        <p className="text-sm font-medium tracking-wide text-line uppercase">
          {monthLabel(visibleMonth)}
        </p>
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
