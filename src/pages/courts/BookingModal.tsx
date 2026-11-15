import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useMemo, useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { ApiError } from '@/api/client'
import { COURTS_QUERY_KEY, type Court, type CourtTimeSlot } from '@/api/courts'
import {
  MAX_GUESTS,
  MAX_NOTES_LENGTH,
  PLAYER_BOOKING_TYPES,
  RESERVATIONS_QUERY_KEY,
  createReservation,
  playerDisplayName,
  type Reservation,
} from '@/api/reservations'
import { useAuth } from '@/auth/auth-context'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { Checkbox } from '@/components/Checkbox'
import { FilterGroup } from '@/components/FilterGroup'
import { Modal } from '@/components/Modal'
import { TextArea } from '@/components/TextArea'
import { TextField } from '@/components/TextField'
import { TimeSlot } from '@/components/TimeSlot'
import {
  BOOKING_TYPE_LABELS,
  bookingErrors,
  buildReservationRequest,
  endOptions,
  endTimeFor,
  estimateTotal,
  formatDuration,
  type BookingFormValues,
} from '@/pages/courts/booking'
import {
  clockTime,
  courtFeatures,
  dayLabel,
  formatAmount,
  inSentence,
  slotDay,
  todayIn,
} from '@/pages/courts/format'

export type BookingTarget = {
  court: Court
  slot: CourtTimeSlot
}

export type BookingModalProps = {
  /** The clicked slot; null keeps the modal closed. */
  target: BookingTarget | null
  onClose: () => void
}

/** Book a court starting at the clicked slot. Full screen on phones. */
export function BookingModal({ target, onClose }: BookingModalProps) {
  if (!target) return null
  // Re-key per slot so a new slot always starts with a fresh form.
  return (
    <BookingDialog
      key={`${target.court.id}-${target.slot.start}`}
      court={target.court}
      slot={target.slot}
      onClose={onClose}
    />
  )
}

const guestEmail = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || z.email().safeParse(value).success,
    'Enter a valid email.',
  )

const bookingSchema = z
  .object({
    end: z.string().min(1),
    bookingType: z.enum(PLAYER_BOOKING_TYPES),
    includesLighting: z.boolean(),
    guests: z.array(z.object({ email: guestEmail })).max(MAX_GUESTS),
    notes: z
      .string()
      .max(MAX_NOTES_LENGTH, `Keep notes under ${MAX_NOTES_LENGTH} characters.`),
  })
  .superRefine((values, context) => {
    const seen = new Set<string>()
    values.guests.forEach((guest, index) => {
      const email = guest.email.trim().toLowerCase()
      if (!email) return
      if (seen.has(email)) {
        context.addIssue({
          code: 'custom',
          path: ['guests', index, 'email'],
          message: 'This guest is already added.',
        })
      }
      seen.add(email)
    })
  })

/** End-time choices shown before "Later end times" (a free day can offer 15+). */
const VISIBLE_END_OPTIONS = 6

type BookingDialogProps = BookingTarget & { onClose: () => void }

function BookingDialog({ court, slot, onClose }: BookingDialogProps) {
  const formId = useId()
  const queryClient = useQueryClient()
  const { refresh: refreshSession } = useAuth()
  const options = useMemo(() => endOptions(court, slot), [court, slot])
  const [showAllEnds, setShowAllEnds] = useState(false)
  const today = todayIn(court.club.timezone)
  const day = dayLabel(slotDay(slot.start), today)
  const startTime = clockTime(slot.start)

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      end: options[0].end,
      bookingType: 'SINGLES',
      includesLighting: false,
      guests: [],
      notes: '',
    },
  })
  const guests = useFieldArray({ control, name: 'guests' })

  const mutation = useMutation({
    mutationFn: createReservation,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: COURTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: RESERVATIONS_QUERY_KEY }),
      ]),
    onError: (error) => {
      const mapped = bookingErrors(error)
      if (mapped.sessionExpired) void refreshSession()
      // Taken slot, or booked but with an odd confirmation: the list is stale.
      if (mapped.conflict || (error instanceof ApiError && error.status === 0)) {
        void queryClient.invalidateQueries({ queryKey: COURTS_QUERY_KEY })
      }
    },
  })
  const serverErrors = mutation.isError ? bookingErrors(mutation.error) : {}

  const end = useWatch({ control, name: 'end' })
  const includesLighting = useWatch({ control, name: 'includesLighting' })
  const notesLength = useWatch({ control, name: 'notes' }).length
  const chosen = options.find((option) => option.end === end) ?? options[0]
  const total = estimateTotal(court, chosen.minutes, includesLighting)
  const fee = Number(court.lighting_fee)

  const onSubmit = handleSubmit((values) => {
    mutation.mutate(buildReservationRequest(court, slot, values))
  })

  // Don't let the dialog vanish under an in-flight booking.
  const close = () => {
    if (!mutation.isPending) onClose()
  }

  if (mutation.isSuccess) {
    return (
      <Modal
        open
        fullScreenOnMobile
        title="Court booked"
        onClose={onClose}
        footer={<Button onClick={onClose}>Done</Button>}
      >
        <BookingConfirmation reservation={mutation.data} day={day} />
      </Modal>
    )
  }

  return (
    <Modal
      open
      fullScreenOnMobile
      title={`Book ${court.name}`}
      onClose={close}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={mutation.isPending}>
            Cancel
          </Button>
          {serverErrors.conflict ? (
            <Button onClick={onClose}>Pick another slot</Button>
          ) : (
            <Button type="submit" form={formId} disabled={mutation.isPending}>
              {mutation.isPending ? 'Booking…' : 'Book court'}
            </Button>
          )}
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-6">
        <div className="border border-line/15 px-4 py-3">
          <p className="text-xs font-medium tracking-wide text-fog uppercase">
            {court.club.name}
          </p>
          <p className="mt-1 text-sm text-mist">{courtFeatures(court)}</p>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-mist">
            {day} · starts {startTime}
          </legend>
          {options.length > 1 ? (
            <Controller
              control={control}
              name="end"
              render={({ field }) => {
                const hidden = options.length - VISIBLE_END_OPTIONS
                const shown =
                  showAllEnds || hidden <= 0
                    ? options
                    : options.slice(0, VISIBLE_END_OPTIONS)
                return (
                  <div className="space-y-2">
                    <div
                      role="group"
                      aria-label="Until"
                      className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                    >
                      {shown.map((option) => (
                        <TimeSlot
                          key={option.end}
                          label={`Until ${endTimeFor(slot.start, option.end)}`}
                          meta={formatDuration(option.minutes)}
                          selected={field.value === option.end}
                          onClick={() => field.onChange(option.end)}
                        />
                      ))}
                    </div>
                    {hidden > 0 && !showAllEnds ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAllEnds(true)}
                      >
                        Later end times ({hidden})
                      </Button>
                    ) : null}
                  </div>
                )
              }}
            />
          ) : (
            <p className="text-sm text-line">
              {startTime}–{endTimeFor(slot.start, chosen.end)} ·{' '}
              {formatDuration(chosen.minutes)}
            </p>
          )}
        </fieldset>

        <Controller
          control={control}
          name="bookingType"
          render={({ field }) => (
            <FilterGroup
              label="Booking type"
              aria-label="Booking type"
              value={field.value}
              onChange={field.onChange}
              options={PLAYER_BOOKING_TYPES.map((value) => ({
                value,
                label: BOOKING_TYPE_LABELS[value],
              }))}
            />
          )}
        />

        {court.has_lighting ? (
          <Checkbox
            label={
              Number.isFinite(fee) && fee > 0
                ? `Include lighting (+${formatAmount(fee)} / hour)`
                : 'Include lighting (no extra charge)'
            }
            {...register('includesLighting')}
          />
        ) : null}

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-mist">Guests</legend>
          <p className="text-sm text-fog">
            Registered players joining you — up to {MAX_GUESTS}.
          </p>
          {guests.fields.map((guest, index) => (
            <div key={guest.id} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <TextField
                  label={`Guest ${index + 1} email`}
                  type="email"
                  autoComplete="off"
                  placeholder="friend@club.example"
                  error={errors.guests?.[index]?.email?.message}
                  {...register(`guests.${index}.email`)}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-8 py-3"
                aria-label={`Remove guest ${index + 1}`}
                onClick={() => guests.remove(index)}
              >
                Remove
              </Button>
            </div>
          ))}
          {serverErrors.guests ? (
            <p className="text-sm text-clay">{serverErrors.guests}</p>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            disabled={guests.fields.length >= MAX_GUESTS}
            onClick={() => guests.append({ email: '' }, { shouldFocus: true })}
          >
            Add guest
          </Button>
        </fieldset>

        <TextArea
          label="Notes (optional)"
          rows={3}
          placeholder="Lesson details, equipment…"
          error={errors.notes?.message ?? serverErrors.notes}
          hint={`${notesLength}/${MAX_NOTES_LENGTH}`}
          {...register('notes')}
        />

        <div className="flex items-end justify-between gap-4 border-t border-line/15 pt-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-fog uppercase">
              Estimated total
            </p>
            <p className="mt-1 text-xs text-fog">
              Confirmed right away — payment isn't taken online yet.
            </p>
          </div>
          <p className="shrink-0 text-2xl font-medium text-line" aria-live="polite">
            {total === null ? '—' : formatAmount(total)}
          </p>
        </div>

        {serverErrors.general ? <Alert>{serverErrors.general}</Alert> : null}
      </form>
    </Modal>
  )
}

function BookingConfirmation({
  reservation,
  day,
}: {
  reservation: Reservation
  day: string
}) {
  const start = clockTime(reservation.start)
  const deadline = reservation.cancellation_deadline
  // Deadlines come in the club's timezone, like the slot times.
  const clubToday = todayIn(reservation.court.club.timezone)
  const canStillCancel = reservation.can_cancel && Boolean(deadline)
  const rows: Array<[string, string]> = [
    ['Court', `${reservation.court.name} · ${reservation.court.club.name}`],
    ['When', `${day}, ${start}–${endTimeFor(reservation.start, reservation.end)}`],
    [
      'Type',
      BOOKING_TYPE_LABELS[reservation.booking_type as keyof typeof BOOKING_TYPE_LABELS] ??
        reservation.booking_type,
    ],
    ['Lighting', reservation.includes_lighting ? 'Included' : 'Not included'],
    [
      'Guests',
      reservation.guests.length
        ? reservation.guests.map(playerDisplayName).join(', ')
        : 'None',
    ],
    ['Total', formatAmount(Number(reservation.total_price))],
  ]

  return (
    <div className="space-y-5">
      <Alert tone="success">
        Court booked for {inSentence(day)} at {start}.
      </Alert>
      <dl className="divide-y divide-line/10 border-y border-line/10">
        {rows.map(([term, value]) => (
          <div key={term} className="flex justify-between gap-4 py-2.5">
            <dt className="text-fog">{term}</dt>
            <dd className="text-right break-words text-line">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-fog">
        {deadline && canStillCancel
          ? `Free cancellation until ${inSentence(dayLabel(slotDay(deadline), clubToday))}, ${clockTime(deadline)}.`
          : "This booking is inside the club's cancellation window, so it can't be cancelled."}
      </p>
    </div>
  )
}
