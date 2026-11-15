import { useId } from 'react'

import type { Reservation } from '@/api/reservations'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { cn } from '@/components/cn'
import { Divider } from '@/components/Divider'
import { clubTimeZoneHint, formatAmount } from '@/pages/courts/format'
import {
  bookingTypeLabel,
  cancellationStatus,
  historyStatus,
  type HistoryTone,
  isAwaitingPayment,
  isGuest,
  reservationDay,
  reservationDuration,
  reservationPeople,
  reservationTimeRange,
  reservationTiming,
} from '@/pages/home/reservationFormat'

export type ReservationCardProps = {
  reservation: Reservation
  /** Current time (ms), for the "in progress" / "starts in" badges. */
  now: number
  /** Shows the Cancel button — enabled only when CourtControl allows it (`can_cancel`). */
  onCancel?: (reservation: Reservation) => void
  /**
   * `upcoming` (Home): timing badges and the cancellation field.
   * `history`: how the booking ended (completed / cancelled / expired) instead.
   */
  variant?: 'upcoming' | 'history'
}

const STATUS_MARKER: Record<HistoryTone, string> = {
  completed: 'bg-ball',
  cancelled: 'bg-clay',
  expired: 'bg-fog',
  other: 'bg-fog',
}

export function ReservationCard({
  reservation,
  now,
  onCancel,
  variant = 'upcoming',
}: ReservationCardProps) {
  const history = variant === 'history'
  const whenId = useId()
  const courtId = useId()
  const reasonId = useId()
  const timing = history ? null : reservationTiming(reservation, now)
  const people = reservationPeople(reservation)
  const cancellation = cancellationStatus(reservation, now)
  const status = historyStatus(reservation)
  const timeZoneHint = clubTimeZoneHint(reservation.court.club)
  const price = Number(reservation.total_price)
  const details = [
    bookingTypeLabel(reservation.booking_type),
    reservation.includes_lighting ? 'Lighting' : null,
    people,
  ].filter(Boolean)

  return (
    <Card role="article" aria-labelledby={`${courtId} ${whenId}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
        {/* One line on phones ("TOMORROW 08:00–10:00 2 h"), a column from sm up. */}
        <div
          id={whenId}
          className="flex shrink-0 flex-wrap items-baseline gap-x-3 sm:block sm:w-36"
        >
          <p className="text-xs font-medium tracking-wide text-ball uppercase">
            {reservationDay(reservation)}
          </p>
          <p className="text-lg font-medium text-line sm:mt-1">
            {reservationTimeRange(reservation)}
          </p>
          <p className="text-sm text-fog">{reservationDuration(reservation)}</p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3
              id={courtId}
              className="text-sm font-medium tracking-wide break-words text-line uppercase"
            >
              {reservation.court.name}
            </h3>
            <div className="flex flex-wrap gap-2">
              {timing?.kind === 'in-progress' ? (
                <Badge tone="accent">In progress</Badge>
              ) : null}
              {timing?.kind === 'soon' ? (
                <Badge tone="accent">Starts in {timing.minutes} min</Badge>
              ) : null}
              {!history && isAwaitingPayment(reservation) ? (
                <Badge tone="warn">Awaiting payment</Badge>
              ) : null}
              {isGuest(reservation) ? <Badge tone="neutral">Guest</Badge> : null}
            </div>
          </div>
          <p className="mt-1 text-sm text-mist">
            {reservation.court.club.name}
            {timeZoneHint ? <span className="text-fog"> · {timeZoneHint}</span> : null}
          </p>
          <p className="mt-1 text-sm break-words text-mist">{details.join(' · ')}</p>
          {reservation.notes ? (
            <p className="mt-2 text-sm break-words text-fog">“{reservation.notes}”</p>
          ) : null}
        </div>
      </div>

      {/* Footer: what it costs, and whether it can be cancelled (or how it ended),
          apart from the details.
          From sm up its columns line up with the ones above (9rem date column). */}
      <Divider className="my-4" />
      <div className="grid grid-cols-[auto_1fr] items-start gap-x-8 gap-y-4 sm:grid-cols-[9rem_1fr_auto] sm:gap-x-6">
        <div>
          <p className="text-xs font-medium tracking-wide text-fog uppercase">Total</p>
          <p className="mt-1 text-base font-medium text-line">
            {Number.isFinite(price) ? formatAmount(price) : '—'}
          </p>
        </div>

        {history ? (
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-fog uppercase">Status</p>
            <p className="mt-1 flex items-center gap-2 text-sm text-line">
              <span
                aria-hidden
                className={cn('h-1.5 w-1.5 shrink-0', STATUS_MARKER[status.tone])}
              />
              {status.label}
            </p>
            {status.detail ? (
              <p className="mt-1 text-xs leading-relaxed break-words text-fog">
                {status.detail}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-fog uppercase">
              Cancellation
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm text-line">
              <span
                aria-hidden
                className={cn(
                  'h-1.5 w-1.5 shrink-0',
                  cancellation.allowed ? 'bg-ball' : 'bg-clay',
                )}
              />
              {cancellation.label}
            </p>
            {cancellation.reason ? (
              <p id={reasonId} className="mt-1 text-xs leading-relaxed text-fog">
                {cancellation.reason}
              </p>
            ) : null}
          </div>
        )}

        {onCancel && !history ? (
          <Button
            variant="danger"
            size="sm"
            aria-haspopup={cancellation.allowed ? 'dialog' : undefined}
            aria-label={`Cancel booking: ${reservation.court.name}, ${reservationDay(reservation)} ${reservationTimeRange(reservation)}`}
            aria-describedby={cancellation.reason ? reasonId : undefined}
            disabled={!cancellation.allowed}
            className="col-span-2 justify-self-start disabled:cursor-not-allowed sm:col-span-1 sm:self-center sm:justify-self-end"
            onClick={() => onCancel(reservation)}
          >
            Cancel booking
          </Button>
        ) : null}
      </div>
    </Card>
  )
}
