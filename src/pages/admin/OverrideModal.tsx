import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useMemo, useState } from 'react'

import { COURTS_QUERY_KEY } from '@/api/courts'
import {
  OVERRIDE_TYPES,
  clubOverridesQueryKey,
  datesInInclusiveRange,
  dayTemplatesQueryKey,
  fetchDayTemplates,
  setOverridesOnCourts,
  setOverridesOnTargets,
  type AffectedBooking,
  type CourtOverride,
  type ManagedCourt,
  type OverrideTarget,
  type OverrideType,
} from '@/api/clubs'
import { playerDisplayName } from '@/api/reservations'
import { useAuth } from '@/auth/auth-context'
import { parseISODate, toISODate } from '@/components/calendarUtils'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { DatePicker } from '@/components/DatePicker'
import { Modal } from '@/components/Modal'
import { Select, type SelectOption } from '@/components/Select'
import { TextArea } from '@/components/TextArea'
import { overrideErrors } from '@/pages/admin/overrideErrors'
import {
  clockTime,
  formatDay,
  noticeLabel,
  slotDay,
  todayIn,
} from '@/pages/courts/format'

const CLOSED = ''
/** Guard against accidental year-long fan-outs (API is one PUT per court×day). */
export const MAX_OVERRIDE_DAYS = 31

function addDays(isoDate: string, days: number): string {
  const date = parseISODate(isoDate)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

type FormState = {
  dateFrom: string
  dateTo: string
  type: OverrideType
  notes: string
  dayTemplateId: string
  courtIds: string[]
}

function describeBooking(booking: AffectedBooking): string {
  return `${formatDay(slotDay(booking.start))}, ${clockTime(booking.start)}–${clockTime(booking.end)} · ${booking.court_name} · ${playerDisplayName(booking.primary_player)}`
}

export type OverrideModalProps = {
  clubId: string
  clubTimezone: string
  courts: ManagedCourt[]
  /** Prefill when editing one existing override; null = new. */
  editing: CourtOverride | null
  onClose: () => void
  onSaved: (result: {
    cancelled: AffectedBooking[]
    courtCount: number
    dayCount: number
  }) => void
}

/** Create or replace a one-day (or date-range) override on one or more courts. */
export function OverrideModal({
  clubId,
  clubTimezone,
  courts,
  editing,
  onClose,
  onSaved,
}: OverrideModalProps) {
  const formId = useId()
  const queryClient = useQueryClient()
  const { refresh: refreshSession } = useAuth()
  const today = todayIn(clubTimezone)
  const isEdit = editing !== null

  const templatesQuery = useQuery({
    queryKey: dayTemplatesQueryKey(clubId),
    queryFn: () => fetchDayTemplates(clubId),
  })

  const [form, setForm] = useState<FormState>(() =>
    editing
      ? {
          dateFrom: editing.date,
          dateTo: editing.date,
          type: (OVERRIDE_TYPES as readonly string[]).includes(editing.type)
            ? (editing.type as OverrideType)
            : 'OTHER',
          notes: editing.notes,
          dayTemplateId: editing.day_template?.id ?? CLOSED,
          courtIds: [editing.courtId],
        }
      : {
          dateFrom: today,
          dateTo: today,
          type: 'OTHER',
          notes: '',
          dayTemplateId: CLOSED,
          courtIds: courts.filter((court) => court.is_active).map((court) => court.id),
        },
  )
  const [localErrors, setLocalErrors] = useState<{
    dateFrom?: string
    dateTo?: string
    courts?: string
  }>({})
  const [pendingConflicts, setPendingConflicts] = useState<AffectedBooking[]>([])
  const [conflictTargets, setConflictTargets] = useState<OverrideTarget[]>([])

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const dates = useMemo(
    () => datesInInclusiveRange(form.dateFrom, isEdit ? form.dateFrom : form.dateTo),
    [form.dateFrom, form.dateTo, isEdit],
  )

  const typeOptions: SelectOption[] = OVERRIDE_TYPES.map((value) => ({
    value,
    label: noticeLabel(value),
  }))
  const templateOptions: SelectOption[] = [
    { value: CLOSED, label: 'Closed — no bookable slots' },
    ...(templatesQuery.data ?? []).map((template) => ({
      value: template.id,
      label: template.name,
      description: template.slots.length
        ? `${template.slots[0].start}–${template.slots.at(-1)!.end}`
        : 'No slots',
    })),
  ]
  const courtOptions: SelectOption[] = courts.map((court) => ({
    value: court.id,
    label: court.name,
    description: court.is_active ? undefined : 'Inactive',
  }))

  const mutation = useMutation({
    mutationFn: async ({ force }: { force: boolean }) => {
      const input = {
        day_template: form.dayTemplateId || null,
        type: form.type,
        notes: form.notes.trim(),
        force: false as boolean,
      }

      const result = force
        ? await setOverridesOnTargets(conflictTargets, { ...input, force: true })
        : await setOverridesOnCourts(form.courtIds, dates, input)

      if (result.failures.length) throw result.failures[0]!.error

      if (result.conflicts.length) {
        const bookings = result.conflicts.flatMap((item) => item.bookings)
        const err = result.conflicts[0]!.error
        ;(err as ApiErrorWithExtra).allConflicts = bookings
        ;(err as ApiErrorWithExtra).conflictTargets = result.conflicts.map(
          ({ courtId, date }) => ({ courtId, date }),
        )
        throw err
      }

      const courtCount = new Set(result.saved.map((item) => item.courtId)).size
      const dayCount = new Set(result.saved.map((item) => item.date)).size
      return {
        cancelled: result.saved.flatMap((item) => item.change.cancelled),
        courtCount,
        dayCount,
      }
    },
    onSuccess: (result) => {
      setPendingConflicts([])
      setConflictTargets([])
      void queryClient.invalidateQueries({ queryKey: clubOverridesQueryKey(clubId) })
      void queryClient.invalidateQueries({ queryKey: COURTS_QUERY_KEY })
      for (const courtId of form.courtIds) {
        void queryClient.invalidateQueries({
          queryKey: ['courts', courtId, 'overrides'],
        })
      }
      onSaved(result)
    },
    onError: (error) => {
      const mapped = overrideErrors(error)
      if (mapped.sessionExpired) void refreshSession()
      const extra = error as ApiErrorWithExtra
      if (extra.allConflicts?.length) setPendingConflicts(extra.allConflicts)
      else if (mapped.conflicts?.length) setPendingConflicts(mapped.conflicts)
      else setPendingConflicts([])
      setConflictTargets(extra.conflictTargets ?? [])
    },
  })

  const serverErrors = mutation.isError ? overrideErrors(mutation.error) : {}
  const conflicts =
    pendingConflicts.length > 0 ? pendingConflicts : (serverErrors.conflicts ?? [])

  const submit = (force = false) => {
    const nextLocal: typeof localErrors = {}
    if (!form.dateFrom) nextLocal.dateFrom = 'Pick a start date.'
    else if (form.dateFrom < today) nextLocal.dateFrom = 'Overrides can only start today or later.'

    if (!isEdit) {
      if (!form.dateTo) nextLocal.dateTo = 'Pick an end date.'
      else if (form.dateTo < form.dateFrom) {
        nextLocal.dateTo = 'End date must be on or after the start date.'
      } else if (dates.length > MAX_OVERRIDE_DAYS) {
        nextLocal.dateTo = `Keep the range to ${MAX_OVERRIDE_DAYS} days or fewer.`
      }
    }

    if (!form.courtIds.length) nextLocal.courts = 'Pick at least one court.'
    setLocalErrors(nextLocal)
    if (Object.keys(nextLocal).length) return
    if (!force) {
      setPendingConflicts([])
      setConflictTargets([])
    }
    mutation.mutate({ force })
  }

  const close = () => {
    if (!mutation.isPending) onClose()
  }

  const dayHint =
    !isEdit && dates.length > 1
      ? `${dates.length} days · ${form.courtIds.length || 0} court${form.courtIds.length === 1 ? '' : 's'}`
      : undefined

  return (
    <Modal
      open
      fullScreenOnMobile
      title={isEdit ? `Override · ${editing.courtName}` : 'New override'}
      onClose={close}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={mutation.isPending}>
            Cancel
          </Button>
          {conflicts.length ? (
            <Button
              variant="danger"
              onClick={() => submit(true)}
              disabled={mutation.isPending}
            >
              {mutation.isPending
                ? 'Saving…'
                : `Cancel ${conflicts.length === 1 ? '1 booking' : `${conflicts.length} bookings`} and save`}
            </Button>
          ) : (
            <Button type="submit" form={formId} disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save override' : 'Create override'}
            </Button>
          )}
        </>
      }
    >
      <form
        id={formId}
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault()
          submit(false)
        }}
        noValidate
      >
        {serverErrors.general ? <Alert>{serverErrors.general}</Alert> : null}
        {conflicts.length ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-mist">
            {conflicts.map((booking) => (
              <li key={booking.id}>{describeBooking(booking)}</li>
            ))}
          </ul>
        ) : null}

        {isEdit ? (
          <DatePicker
            label="Date"
            value={form.dateFrom}
            min={today}
            clearable={false}
            onChange={(date) => {
              patch('dateFrom', date)
              patch('dateTo', date)
            }}
            error={localErrors.dateFrom ?? serverErrors.date}
            hint={`Club timezone: ${clubTimezone.replace(/_/g, ' ')}`}
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <DatePicker
              label="From"
              value={form.dateFrom}
              min={today}
              clearable={false}
              onChange={(date) => {
                patch('dateFrom', date)
                if (!form.dateTo || form.dateTo < date) patch('dateTo', date)
                else if (form.dateTo > addDays(date, MAX_OVERRIDE_DAYS - 1)) {
                  patch('dateTo', addDays(date, MAX_OVERRIDE_DAYS - 1))
                }
              }}
              error={localErrors.dateFrom ?? serverErrors.date}
            />
            <DatePicker
              label="Until"
              value={form.dateTo}
              min={form.dateFrom || today}
              max={
                form.dateFrom
                  ? addDays(form.dateFrom, MAX_OVERRIDE_DAYS - 1)
                  : undefined
              }
              clearable={false}
              onChange={(date) => patch('dateTo', date)}
              error={localErrors.dateTo}
              hint={
                dayHint
                  ? `${dayHint}. Club timezone: ${clubTimezone.replace(/_/g, ' ')}`
                  : `Up to ${MAX_OVERRIDE_DAYS} days. Club timezone: ${clubTimezone.replace(/_/g, ' ')}`
              }
            />
          </div>
        )}

        <Select
          label="Reason"
          options={typeOptions}
          value={form.type}
          onChange={(value) => patch('type', (value || form.type) as OverrideType)}
          clearable={false}
          error={serverErrors.type}
        />

        <TextArea
          label="Notes for players"
          value={form.notes}
          onChange={(event) => patch('notes', event.target.value)}
          rows={3}
          maxLength={500}
          error={serverErrors.notes}
          hint="Shown on the courts list and when booking is blocked."
        />

        <Select
          label="Slots those days"
          options={templateOptions}
          value={form.dayTemplateId}
          onChange={(value) => patch('dayTemplateId', value)}
          clearable={false}
          error={serverErrors.day_template}
          hint="Closed removes every slot; a day template replaces the weekly schedule for each date."
        />

        <div className="space-y-2">
          <Select
            label="Courts"
            multiple
            options={courtOptions}
            value={form.courtIds}
            onChange={(courtIds) => patch('courtIds', courtIds)}
            placeholder="Select courts…"
            error={localErrors.courts ?? serverErrors.courts}
            hint={
              isEdit
                ? 'Editing applies to the courts you leave selected.'
                : 'Same override is applied to every selected court on every day in the range.'
            }
          />
          {!isEdit && courts.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  patch(
                    'courtIds',
                    courts.filter((court) => court.is_active).map((court) => court.id),
                  )
                }
              >
                All active
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => patch('courtIds', courts.map((court) => court.id))}
              >
                All courts
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => patch('courtIds', [])}
              >
                Clear
              </Button>
            </div>
          ) : null}
        </div>
      </form>
    </Modal>
  )
}

type ApiErrorWithExtra = {
  allConflicts?: AffectedBooking[]
  conflictTargets?: OverrideTarget[]
}
