import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { COURTS_QUERY_KEY } from '@/api/courts'
import {
  MAX_CANCEL_REASON_LENGTH,
  RESERVATIONS_QUERY_KEY,
  cancelReservation,
  playerDisplayName,
  type Reservation,
} from '@/api/reservations'
import { useAuth } from '@/auth/auth-context'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { TextArea } from '@/components/TextArea'
import { clubTimeZoneHint, plural } from '@/pages/courts/format'
import { cancelErrors } from '@/pages/home/cancellation'
import {
  bookingTypeLabel,
  cancellationNote,
  isAwaitingPayment,
  reservationDay,
  reservationTimeRange,
} from '@/pages/home/reservationFormat'

export type CancelReservationModalProps = {
  /** The booking to cancel; null keeps the dialog closed. */
  reservation: Reservation | null
  onClose: () => void
  /** Called once CourtControl confirms the cancellation. */
  onCancelled: (reservation: Reservation) => void
}

/** "Cancel booking?" confirmation — nothing is cancelled until the user confirms. */
export function CancelReservationModal({
  reservation,
  onClose,
  onCancelled,
}: CancelReservationModalProps) {
  if (!reservation) return null
  // Re-key per booking so each confirmation starts clean.
  return (
    <CancelDialog
      key={reservation.id}
      reservation={reservation}
      onClose={onClose}
      onCancelled={onCancelled}
    />
  )
}

type CancelDialogProps = Omit<CancelReservationModalProps, 'reservation'> & {
  reservation: Reservation
}

function CancelDialog({ reservation, onClose, onCancelled }: CancelDialogProps) {
  const queryClient = useQueryClient()
  const { refresh: refreshSession } = useAuth()
  const keepRef = useRef<HTMLButtonElement>(null)
  const [reason, setReason] = useState('')

  const refreshLists = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: RESERVATIONS_QUERY_KEY }),
      // The slot is bookable again.
      queryClient.invalidateQueries({ queryKey: COURTS_QUERY_KEY }),
    ])

  const mutation = useMutation({
    mutationFn: () => cancelReservation(reservation.id, reason),
    onSuccess: (cancelled) => {
      void refreshLists()
      onCancelled(cancelled)
    },
    onError: (error) => {
      const mapped = cancelErrors(error)
      if (mapped.sessionExpired) void refreshSession()
      if (mapped.stale) void refreshLists()
    },
  })
  const errors = mutation.isError ? cancelErrors(mutation.error) : {}
  const pending = mutation.isPending

  // Don't let the dialog vanish under an in-flight cancellation.
  const close = () => {
    if (!pending) onClose()
  }

  const guests = reservation.guests
  const policy = cancellationNote(reservation)
  // Times and the deadline are club-local, like on the card.
  const timeZoneHint = clubTimeZoneHint(reservation.court.club)

  return (
    <Modal
      open
      fullScreenOnMobile
      title="Cancel booking?"
      onClose={close}
      initialFocusRef={keepRef}
      footer={
        <>
          <Button ref={keepRef} variant="ghost" onClick={close} disabled={pending}>
            Keep booking
          </Button>
          <Button
            variant="danger"
            onClick={() => mutation.mutate()}
            disabled={pending || errors.final}
          >
            {pending ? 'Cancelling…' : 'Cancel booking'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="border border-line/15 px-4 py-3">
          <p className="text-xs font-medium tracking-wide text-fog uppercase">
            {reservation.court.club.name}
          </p>
          <p className="mt-1 text-base font-medium text-line">{reservation.court.name}</p>
          <p className="mt-1 text-sm text-mist">
            {reservationDay(reservation)}, {reservationTimeRange(reservation)} ·{' '}
            {bookingTypeLabel(reservation.booking_type)}
          </p>
          {timeZoneHint ? <p className="mt-1 text-xs text-fog">{timeZoneHint}</p> : null}
        </div>

        <ul className="list-disc space-y-1 pl-5">
          <li>The court is released for other players right away.</li>
          {guests.length > 0 ? (
            <li>
              {plural(guests.length, 'guest')} will be notified:{' '}
              {guests.map(playerDisplayName).join(', ')}.
            </li>
          ) : null}
          {isAwaitingPayment(reservation) ? (
            <li>This hold hasn't been paid yet.</li>
          ) : null}
          {policy ? <li>{policy}</li> : null}
        </ul>

        <TextArea
          label="Reason (optional)"
          rows={3}
          placeholder="Rain, injury, change of plans…"
          value={reason}
          maxLength={MAX_CANCEL_REASON_LENGTH}
          onChange={(event) => setReason(event.target.value)}
          disabled={pending}
          error={errors.reason}
          hint={`Saved with the booking. ${reason.length}/${MAX_CANCEL_REASON_LENGTH}`}
        />

        {errors.general ? <Alert>{errors.general}</Alert> : null}
      </div>
    </Modal>
  )
}
