import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useMemo, useState } from 'react'

import { COURTS_QUERY_KEY } from '@/api/courts'
import {
  COURT_SURFACES,
  WEEKDAYS,
  WEEKDAY_LABELS,
  clubCourtsQueryKey,
  createClubCourt,
  createCourtSchedule,
  currentSchedule,
  dayTemplatesEqual,
  dayTemplatesQueryKey,
  emptyDayTemplates,
  fetchCourtSchedules,
  fetchDayTemplates,
  groupDayTemplates,
  hasAnyOpenDay,
  scheduleDayTemplates,
  sharedDayTemplate,
  updateClubCourt,
  type AffectedBooking,
  type CourtSurface,
  type DayTemplatesByWeekday,
  type ManagedCourt,
  type ManagedCourtChange,
  type ManagedCourtInput,
  type Weekday,
} from '@/api/clubs'
import { playerDisplayName } from '@/api/reservations'
import { useAuth } from '@/auth/auth-context'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { Checkbox } from '@/components/Checkbox'
import { Modal } from '@/components/Modal'
import { Select, type SelectOption } from '@/components/Select'
import { Spinner } from '@/components/Spinner'
import { TextField } from '@/components/TextField'
import { courtErrors, normalizeMoney } from '@/pages/admin/courtErrors'
import {
  clockTime,
  formatDay,
  slotDay,
  surfaceLabel,
  todayIn,
} from '@/pages/courts/format'

/** Select value for a closed day (no template). */
const CLOSED = ''

type FormState = {
  name: string
  surface_type: CourtSurface
  is_indoor: boolean
  is_singles_only: boolean
  has_lighting: boolean
  hourly_rate: string
  lighting_fee: string
  is_active: boolean
  /** Day template per weekday; empty = closed that day. */
  dayTemplates: DayTemplatesByWeekday
}

const SURFACE_OPTIONS: SelectOption[] = COURT_SURFACES.map((value) => ({
  value,
  label: surfaceLabel(value),
}))

function defaults(
  court: ManagedCourt | null,
  dayTemplates: DayTemplatesByWeekday,
): FormState {
  return {
    name: court?.name ?? '',
    surface_type: (COURT_SURFACES as readonly string[]).includes(court?.surface_type ?? '')
      ? (court!.surface_type as CourtSurface)
      : 'CLAY',
    is_indoor: court?.is_indoor ?? false,
    is_singles_only: court?.is_singles_only ?? false,
    has_lighting: court?.has_lighting ?? true,
    hourly_rate: court?.hourly_rate ?? '0.00',
    lighting_fee: court?.lighting_fee ?? '0.00',
    is_active: court?.is_active ?? true,
    dayTemplates,
  }
}

function describeBooking(booking: AffectedBooking): string {
  return `${formatDay(slotDay(booking.start))}, ${clockTime(booking.start)}–${clockTime(booking.end)} · ${booking.court_name} · ${playerDisplayName(booking.primary_player)}`
}

function courtDiff(
  initial: FormState,
  current: FormState,
): Partial<ManagedCourtInput> {
  const changes: Partial<ManagedCourtInput> = {}
  if (current.name.trim() !== initial.name.trim()) changes.name = current.name.trim()
  if (current.surface_type !== initial.surface_type) changes.surface_type = current.surface_type
  if (current.is_indoor !== initial.is_indoor) changes.is_indoor = current.is_indoor
  if (current.is_singles_only !== initial.is_singles_only) {
    changes.is_singles_only = current.is_singles_only
  }
  if (current.has_lighting !== initial.has_lighting) changes.has_lighting = current.has_lighting
  if (current.hourly_rate !== initial.hourly_rate) changes.hourly_rate = current.hourly_rate
  if (current.lighting_fee !== initial.lighting_fee) changes.lighting_fee = current.lighting_fee
  if (current.is_active !== initial.is_active) changes.is_active = current.is_active
  return changes
}

export type CourtModalProps = {
  clubId: string
  /** Club timezone — schedule versions start “today” here. */
  clubTimezone: string
  court: ManagedCourt | null
  onClose: () => void
  onSaved: (court: ManagedCourt, cancelled: AffectedBooking[]) => void
}

/** Create or edit a club court, optionally linking day templates for the week. */
export function CourtModal({
  clubId,
  clubTimezone,
  court,
  onClose,
  onSaved,
}: CourtModalProps) {
  const formId = useId()
  const queryClient = useQueryClient()
  const { refresh: refreshSession } = useAuth()
  const editing = court !== null

  const templatesQuery = useQuery({
    queryKey: dayTemplatesQueryKey(clubId),
    queryFn: () => fetchDayTemplates(clubId),
  })
  const schedulesQuery = useQuery({
    queryKey: ['courts', court?.id, 'schedules'],
    queryFn: () => fetchCourtSchedules(court!.id),
    enabled: Boolean(court),
  })

  const loadedDayTemplates = useMemo(
    () => scheduleDayTemplates(currentSchedule(schedulesQuery.data ?? [])),
    [schedulesQuery.data],
  )

  const ready = templatesQuery.isSuccess && (!editing || schedulesQuery.isSuccess)
  const [form, setForm] = useState<FormState | null>(null)
  const [initial, setInitial] = useState<FormState | null>(null)
  const [localErrors, setLocalErrors] = useState<{
    name?: string
    hourly_rate?: string
    lighting_fee?: string
  }>({})

  useEffect(() => {
    if (!ready || form !== null) return
    const seeded = defaults(
      court,
      editing ? loadedDayTemplates : emptyDayTemplates(),
    )
    setInitial(seeded)
    setForm(seeded)
  }, [ready, form, court, editing, loadedDayTemplates])

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current))

  const setDayTemplate = (day: Weekday, templateId: string) =>
    setForm((current) =>
      current
        ? {
            ...current,
            dayTemplates: { ...current.dayTemplates, [day]: templateId },
          }
        : current,
    )

  const applyToAll = (templateId: string) =>
    setForm((current) => {
      if (!current) return current
      const dayTemplates = emptyDayTemplates()
      for (const day of WEEKDAYS) dayTemplates[day] = templateId
      return { ...current, dayTemplates }
    })

  const templateOptions: SelectOption[] = (templatesQuery.data ?? []).map((template) => ({
    value: template.id,
    label: template.name,
    description: template.slots.length
      ? `${template.slots[0].start}–${template.slots.at(-1)!.end}`
      : 'No slots (closed day)',
  }))

  const dayOptions: SelectOption[] = [
    { value: CLOSED, label: 'Closed' },
    ...templateOptions,
  ]

  const allDaysValue = form ? sharedDayTemplate(form.dayTemplates) : null

  const mutation = useMutation({
    mutationFn: async ({ force }: { force: boolean }): Promise<ManagedCourtChange> => {
      if (!form || !initial) throw new Error('form-not-ready')
      const hourly = normalizeMoney(form.hourly_rate)
      const lighting = normalizeMoney(form.lighting_fee)
      if (!hourly || !lighting) throw new Error('invalid-money')

      const normalized: FormState = {
        ...form,
        name: form.name.trim(),
        hourly_rate: hourly,
        lighting_fee: lighting,
      }

      let change: ManagedCourtChange
      if (!editing) {
        change = {
          court: await createClubCourt(clubId, normalized),
          cancelled: [],
        }
      } else {
        const changes = courtDiff(
          {
            ...initial,
            hourly_rate: normalizeMoney(initial.hourly_rate) ?? initial.hourly_rate,
            lighting_fee: normalizeMoney(initial.lighting_fee) ?? initial.lighting_fee,
          },
          normalized,
        )
        change =
          Object.keys(changes).length || force
            ? await updateClubCourt(clubId, court.id, force ? { ...changes, force: true } : changes)
            : { court, cancelled: [] }
      }

      const scheduleDirty = !dayTemplatesEqual(initial.dayTemplates, normalized.dayTemplates)
      const needsSchedule =
        scheduleDirty &&
        (hasAnyOpenDay(normalized.dayTemplates) ||
          (editing && hasAnyOpenDay(initial.dayTemplates)))

      if (needsSchedule) {
        const scheduled = await createCourtSchedule(change.court.id, {
          valid_from: todayIn(clubTimezone),
          days: groupDayTemplates(normalized.dayTemplates),
          force,
        })
        change = {
          court: change.court,
          cancelled: [...change.cancelled, ...scheduled.cancelled],
        }
      }

      return change
    },
    onSuccess: (change) => {
      void queryClient.invalidateQueries({ queryKey: clubCourtsQueryKey(clubId) })
      void queryClient.invalidateQueries({ queryKey: COURTS_QUERY_KEY })
      if (change.court.id) {
        void queryClient.invalidateQueries({
          queryKey: ['courts', change.court.id, 'schedules'],
        })
      }
      onSaved(change.court, change.cancelled)
    },
    onError: (error) => {
      if (
        error instanceof Error &&
        (error.message === 'invalid-money' || error.message === 'form-not-ready')
      ) {
        return
      }
      const mapped = courtErrors(error)
      if (mapped.sessionExpired) void refreshSession()
      if (mapped.stale) {
        void queryClient.invalidateQueries({ queryKey: clubCourtsQueryKey(clubId) })
        if (court) {
          void queryClient.invalidateQueries({
            queryKey: ['courts', court.id, 'schedules'],
          })
        }
      }
    },
  })

  const serverErrors = mutation.isError ? courtErrors(mutation.error) : {}
  const conflicts = serverErrors.conflicts ?? []

  const submit = (force = false) => {
    if (!form) return
    const nextLocal: typeof localErrors = {}
    if (!form.name.trim()) nextLocal.name = 'Give the court a name, e.g. “Court 1 - Guga”.'
    if (!normalizeMoney(form.hourly_rate)) {
      nextLocal.hourly_rate = 'Enter a non-negative amount, e.g. 120.00.'
    }
    if (!normalizeMoney(form.lighting_fee)) {
      nextLocal.lighting_fee = 'Enter a non-negative amount, e.g. 30.00.'
    }
    setLocalErrors(nextLocal)
    if (Object.keys(nextLocal).length) return
    mutation.mutate({ force })
  }

  const close = () => {
    if (!mutation.isPending) onClose()
  }

  return (
    <Modal
      open
      fullScreenOnMobile
      title={editing ? `Edit ${court.name}` : 'New court'}
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
              disabled={mutation.isPending || !form}
            >
              {mutation.isPending
                ? 'Saving…'
                : `Cancel ${conflicts.length === 1 ? '1 booking' : `${conflicts.length} bookings`} and save`}
            </Button>
          ) : (
            <Button
              type="submit"
              form={formId}
              disabled={mutation.isPending || !form}
            >
              {mutation.isPending
                ? 'Saving…'
                : editing
                  ? 'Save changes'
                  : 'Create court'}
            </Button>
          )}
        </>
      }
    >
      {!form ? (
        <Spinner label="Loading court settings…" />
      ) : (
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

          <TextField
            label="Name"
            value={form.name}
            onChange={(event) => patch('name', event.target.value)}
            error={localErrors.name ?? serverErrors.name}
            autoFocus
          />

          <Select
            label="Surface"
            options={SURFACE_OPTIONS}
            value={form.surface_type}
            onChange={(value) =>
              patch('surface_type', (value || form.surface_type) as CourtSurface)
            }
            clearable={false}
            error={serverErrors.surface_type}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Hourly rate"
              inputMode="decimal"
              value={form.hourly_rate}
              onChange={(event) => patch('hourly_rate', event.target.value)}
              error={localErrors.hourly_rate ?? serverErrors.hourly_rate}
            />
            <TextField
              label="Lighting fee"
              inputMode="decimal"
              value={form.lighting_fee}
              onChange={(event) => patch('lighting_fee', event.target.value)}
              error={localErrors.lighting_fee ?? serverErrors.lighting_fee}
              hint="Added when a booking uses lighting."
            />
          </div>

          <div className="space-y-3">
            <Checkbox
              label="Indoor"
              checked={form.is_indoor}
              onChange={(event) => patch('is_indoor', event.target.checked)}
            />
            <Checkbox
              label="Singles only (too narrow for doubles — at most one guest)"
              checked={form.is_singles_only}
              onChange={(event) => patch('is_singles_only', event.target.checked)}
            />
            <Checkbox
              label="Has lighting"
              checked={form.has_lighting}
              onChange={(event) => patch('has_lighting', event.target.checked)}
            />
            {editing ? (
              <Checkbox
                label="Active — listed for players to book"
                checked={form.is_active}
                onChange={(event) => patch('is_active', event.target.checked)}
              />
            ) : null}
          </div>

          <fieldset className="space-y-4 border border-line/15 p-4">
            <legend className="px-1 text-sm font-medium text-mist">
              Weekly schedule
            </legend>
            <p className="text-sm text-fog">
              Pick a day template for each weekday, or apply one to every day. Closed days
              have no bookable slots. Changes apply from today (
              {todayIn(clubTimezone).replace(/-/g, '/')} in the club’s timezone).
            </p>
            {templatesQuery.isError ? (
              <Alert>Couldn’t load day templates. Create some under Day templates first.</Alert>
            ) : null}
            {!templatesQuery.isPending && templateOptions.length === 0 ? (
              <Alert tone="info">
                No day templates yet — create one under Day templates, then link it here.
              </Alert>
            ) : null}

            <Select
              label="Apply to all days"
              options={
                allDaysValue === null
                  ? [{ value: '__mixed__', label: 'Mixed', disabled: true }, ...dayOptions]
                  : dayOptions
              }
              value={allDaysValue === null ? '__mixed__' : allDaysValue}
              onChange={(value) => {
                if (value !== '__mixed__') applyToAll(value)
              }}
              clearable={false}
              hint="Sets Monday through Sunday to the same template (or Closed)."
            />

            <div className="grid gap-3 sm:grid-cols-2">
              {WEEKDAYS.map((day) => (
                <Select
                  key={day}
                  label={WEEKDAY_LABELS[day]}
                  options={dayOptions}
                  value={form.dayTemplates[day]}
                  onChange={(value) => setDayTemplate(day, value)}
                  clearable={false}
                />
              ))}
            </div>
          </fieldset>
        </form>
      )}
    </Modal>
  )
}
