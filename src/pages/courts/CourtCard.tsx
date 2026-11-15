import { useId } from 'react'

import type { Court, CourtTimeSlot } from '@/api/courts'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Card } from '@/components/Card'
import { TimeSlot } from '@/components/TimeSlot'
import { formatDuration } from '@/pages/courts/booking'
import {
  clockTime,
  courtCardId,
  courtFeatures,
  courtPricing,
  dayLabel,
  groupSlotsByDay,
  noticeLabel,
  plural,
  slotLabel,
  todayIn,
} from '@/pages/courts/format'

function slotMinutes(slot: CourtTimeSlot): number {
  return Math.round((Date.parse(slot.end) - Date.parse(slot.start)) / 60_000)
}

/** "today" / "tomorrow" / "on Sat, Nov 14" — reads naturally after "Open". */
function relativeDay(isoDate: string, today: string): string {
  const label = dayLabel(isoDate, today)
  return label === 'Today' || label === 'Tomorrow' ? label.toLowerCase() : `on ${label}`
}

export type CourtCardProps = {
  court: Court
  /** Called with the clicked slot — opens the booking flow. */
  onBook: (court: Court, slot: CourtTimeSlot) => void
}

export function CourtCard({ court, onBook }: CourtCardProps) {
  const titleId = useId()
  const slotCount = court.available_slots.length
  const pricing = courtPricing(court)
  // Slot and notice dates are club-local, so "today" is the club's today.
  const today = todayIn(court.club.timezone)
  const days = groupSlotsByDay(court.available_slots)

  return (
    <Card
      id={courtCardId(court.id)}
      aria-labelledby={titleId}
      role="article"
      // Focus target after booking, when the clicked slot button is gone.
      tabIndex={-1}
      className="outline-none focus-visible:ring-2 focus-visible:ring-ball/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            id={titleId}
            className="text-sm font-medium tracking-wide break-words text-line uppercase"
          >
            {court.name}
          </h3>
          <p className="mt-1 text-sm text-mist">{courtFeatures(court)}</p>
          {pricing ? <p className="mt-1 text-sm text-fog">{pricing}</p> : null}
        </div>
        <Badge tone={slotCount > 0 ? 'accent' : 'muted'} className="shrink-0">
          {slotCount > 0 ? plural(slotCount, 'slot') : 'No slots'}
        </Badge>
      </div>

      {court.notices.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {court.notices.map((notice, index) => (
            <li key={`${notice.date}-${notice.type}-${index}`}>
              {/* Informational, not an error: don't announce it as an alert. */}
              <Alert tone="info" role="note">
                <span className="text-fog">{dayLabel(notice.date, today)} · </span>
                <span className="font-medium text-line">{noticeLabel(notice.type)}</span>
                {notice.notes ? <> · {notice.notes}</> : null}
              </Alert>
            </li>
          ))}
        </ul>
      ) : null}

      {slotCount > 0 ? (
        <div className="mt-4 space-y-3">
          {days.map((day) => {
            const when = relativeDay(day.date, today)
            return (
              <div key={day.date}>
                <p className="text-xs font-medium tracking-wide text-fog uppercase">
                  Open {when}
                </p>
                <ul
                  aria-label={`Open slots for ${court.name} ${when}`}
                  className="mt-2 flex flex-wrap gap-2"
                >
                  {day.slots.map((slot) => (
                    <li key={slot.start}>
                      <TimeSlot
                        label={clockTime(slot.start)}
                        meta={formatDuration(slotMinutes(slot))}
                        aria-label={`Book ${court.name} ${when}, ${slotLabel(slot)}`}
                        aria-haspopup="dialog"
                        // Opens a dialog; it isn't a toggle.
                        aria-pressed={undefined}
                        onClick={() => onBook(court, slot)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="mt-4 text-sm text-fog">No open slots left today.</p>
      )}
    </Card>
  )
}
