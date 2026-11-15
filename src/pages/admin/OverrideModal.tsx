import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'

import { COURTS_QUERY_KEY } from '@/api/courts'
import {
  OVERRIDE_TYPES,
  clubOverridesQueryKey,
  dayTemplatesQueryKey,
  fetchDayTemplates,
  setOverridesOnCourts,
  type AffectedBooking,
  type CourtOverride,
  type ManagedCourt,
  type OverrideType,
} from '@/api/clubs'
import { playerDisplayName } from '@/api/reservations'
import { useAuth } from '@/auth/auth-context'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { DateField } from '@/components/DateField'
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

type FormState = {
  date: string
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
  onSaved: (cancelled: AffectedBooking[], courtCount: number) => void
}

/** Create or replace a one-day override on one or more courts. */
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
          date: editing.date,
          type: (OVERRIDE_TYPES as readonly string[]).includes(editing.type)
            ? (editing.type as OverrideType)
            : 'OTHER',
          notes: editing.notes,
          dayTemplateId: editing.day_template?.id ?? CLOSED,
          courtIds: [editing.courtId],
        }
      : {
          date: today,
          type: 'OTHER',
          notes: '',
          dayTemplateId: CLOSED,
          courtIds: courts.filter((court) => court.is_active).map((court) => court.id),
        },
  )
  const [localErrors, setLocalErrors] = useState<{
    date?: string
    courts?: string
  }>({})
  const [pendingConflicts, setPendingConflicts] = useState<AffectedBooking[]>([])

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

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
      let result = await setOverridesOnCourts(form.courtIds, form.date, input)

      if (result.conflicts.length && force) {
        const retry = await setOverridesOnCourts(
          result.conflicts.map((item) => item.courtId),
          form.date,
          { ...input, force: true },
        )
        result = {
          saved: [...result.saved, ...retry.saved],
          conflicts: retry.conflicts,
          failures: [...result.failures, ...retry.failures],
        }
      }

      if (result.failures.length) throw result.failures[0]!.error

      if (result.conflicts.length) {
        const bookings = result.conflicts.flatMap((item) => item.bookings)
        const err = result.conflicts[0]!.error
        ;(err as ApiErrorWithExtra).allConflicts = bookings
        throw err
      }

      return {
        cancelled: result.saved.flatMap((item) => item.change.cancelled),
        courtCount: result.saved.length,
      }
    },
    onSuccess: (result) => {
      setPendingConflicts([])
      void queryClient.invalidateQueries({ queryKey: clubOverridesQueryKey(clubId) })
      void queryClient.invalidateQueries({ queryKey: COURTS_QUERY_KEY })
      for (const courtId of form.courtIds) {
        void queryClient.invalidateQueries({
          queryKey: ['courts', courtId, 'overrides'],
        })
      }
      onSaved(result.cancelled, result.courtCount)
    },
    onError: (error) => {
      const mapped = overrideErrors(error)
      if (mapped.sessionExpired) void refreshSession()
      const extra = (error as ApiErrorWithExtra).allConflicts
      if (extra?.length) setPendingConflicts(extra)
      else if (mapped.conflicts?.length) setPendingConflicts(mapped.conflicts)
      else setPendingConflicts([])
    },
  })

  const serverErrors = mutation.isError ? overrideErrors(mutation.error) : {}
  const conflicts =
    pendingConflicts.length > 0 ? pendingConflicts : (serverErrors.conflicts ?? [])

  const submit = (force = false) => {
    const nextLocal: typeof localErrors = {}
    if (!form.date) nextLocal.date = 'Pick a date.'
    else if (form.date < today) nextLocal.date = 'Overrides can only start today or later.'
    if (!form.courtIds.length) nextLocal.courts = 'Pick at least one court.'
    setLocalErrors(nextLocal)
    if (Object.keys(nextLocal).length) return
    if (!force) setPendingConflicts([])
    mutation.mutate({ force })
  }

  const close = () => {
    if (!mutation.isPending) onClose()
  }

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

        <DateField
          label="Date"
          value={form.date}
          min={today}
          onChange={(date) => patch('date', date)}
          error={localErrors.date ?? serverErrors.date}
          hint={`Club timezone: ${clubTimezone.replace(/_/g, ' ')}`}
        />

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
          label="Slots that day"
          options={templateOptions}
          value={form.dayTemplateId}
          onChange={(value) => patch('dayTemplateId', value)}
          clearable={false}
          error={serverErrors.day_template}
          hint="Closed removes every slot; a day template replaces the weekly schedule for that date."
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
                : 'Same override is applied to every selected court.'
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

type ApiErrorWithExtra = { allConflicts?: AffectedBooking[] }
