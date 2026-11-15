import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'

import { COURTS_QUERY_KEY } from '@/api/courts'
import {
  createDayTemplate,
  dayTemplatesQueryKey,
  updateDayTemplate,
  type AffectedBooking,
  type DayTemplate,
  type DayTemplateChange,
  type TemplateSlot,
} from '@/api/clubs'
import { playerDisplayName } from '@/api/reservations'
import { useAuth } from '@/auth/auth-context'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { FilterGroup } from '@/components/FilterGroup'
import { Modal } from '@/components/Modal'
import { Select, type SelectOption } from '@/components/Select'
import { TextField } from '@/components/TextField'
import { clockTime, formatDay, slotDay } from '@/pages/courts/format'
import {
  QUARTER_ENDS,
  QUARTER_STARTS,
  SLOT_LENGTHS,
  gridSlots,
  nextSlot,
  sortSlots,
  summarizeSlots,
  templateErrors,
  validateSlots,
} from '@/pages/admin/templateSlots'

const toOptions = (times: string[]): SelectOption[] =>
  times.map((time) => ({ value: time, label: time }))
const START_OPTIONS = toOptions(QUARTER_STARTS)
const END_OPTIONS = toOptions(QUARTER_ENDS)

export type DayTemplateModalProps = {
  clubId: string
  /** Editing this template; null = creating a new one. */
  template: DayTemplate | null
  onClose: () => void
  /** After a save, with any bookings the change cancelled. */
  onSaved: (template: DayTemplate, cancelled: AffectedBooking[]) => void
}

const sameSlots = (a: TemplateSlot[], b: TemplateSlot[]) =>
  JSON.stringify(sortSlots(a)) === JSON.stringify(sortSlots(b))

/** "Sat, Nov 14, 18:00–19:00 · Court 1 · Ana Silva" */
function describeBooking(booking: AffectedBooking): string {
  return `${formatDay(slotDay(booking.start))}, ${clockTime(booking.start)}–${clockTime(booking.end)} · ${booking.court_name} · ${playerDisplayName(booking.primary_player)}`
}

/** Create or edit a day template. Slots are wall-clock in the club's timezone. */
export function DayTemplateModal({
  clubId,
  template,
  onClose,
  onSaved,
}: DayTemplateModalProps) {
  const formId = useId()
  const queryClient = useQueryClient()
  const { refresh: refreshSession } = useAuth()
  const editing = template !== null
  const locked = template?.locked ?? false

  const [name, setName] = useState(template?.name ?? '')
  const [slots, setSlots] = useState<TemplateSlot[]>(() =>
    sortSlots(template?.slots ?? []),
  )
  const [fill, setFill] = useState({ open: '08:00', close: '22:00', minutes: 60 })
  const [nameError, setNameError] = useState<string | null>(null)
  const [showSlotErrors, setShowSlotErrors] = useState(false)

  const slotErrors = validateSlots(slots)
  const slotsInvalid = Object.keys(slotErrors).length > 0

  const mutation = useMutation({
    mutationFn: async ({ force }: { force: boolean }): Promise<DayTemplateChange> => {
      const trimmed = name.trim()
      if (!editing) {
        return {
          template: await createDayTemplate(clubId, { name: trimmed, slots }),
          cancelled: [],
        }
      }
      const changes: { name?: string; slots?: TemplateSlot[]; force?: boolean } = {}
      if (trimmed !== template.name) changes.name = trimmed
      if (!locked && !sameSlots(slots, template.slots)) changes.slots = slots
      if (force) changes.force = true
      return updateDayTemplate(clubId, template.id, changes)
    },
    onSuccess: (change) => {
      void queryClient.invalidateQueries({ queryKey: dayTemplatesQueryKey(clubId) })
      // Changed slots change court availability (and may have cancelled bookings).
      if (change.cancelled.length || !locked) {
        void queryClient.invalidateQueries({ queryKey: COURTS_QUERY_KEY })
      }
      onSaved(change.template, change.cancelled)
    },
    onError: (error) => {
      const mapped = templateErrors(error)
      if (mapped.sessionExpired) void refreshSession()
      if (mapped.stale)
        void queryClient.invalidateQueries({ queryKey: dayTemplatesQueryKey(clubId) })
    },
  })
  const serverErrors = mutation.isError ? templateErrors(mutation.error) : {}
  const conflicts = serverErrors.conflicts ?? []

  const submit = (force = false) => {
    if (!name.trim()) {
      setNameError('Give the template a name, e.g. “Weekdays”.')
      return
    }
    setNameError(null)
    if (slotsInvalid) {
      setShowSlotErrors(true)
      return
    }
    mutation.mutate({ force })
  }

  const updateSlot = (index: number, patch: Partial<TemplateSlot>) =>
    setSlots((current) =>
      current.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)),
    )
  const addSlot = () => {
    const next = nextSlot(slots)
    if (next) setSlots((current) => [...current, next])
  }
  const fillDay = () => {
    setSlots(gridSlots(fill.open, fill.close, fill.minutes))
    setShowSlotErrors(false)
  }

  const close = () => {
    if (!mutation.isPending) onClose()
  }

  return (
    <Modal
      open
      fullScreenOnMobile
      title={editing ? `Edit ${template.name}` : 'New day template'}
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
              {mutation.isPending
                ? 'Saving…'
                : editing
                  ? 'Save changes'
                  : 'Create template'}
            </Button>
          )}
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <TextField
          label="Name"
          placeholder="Weekdays"
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={nameError ?? serverErrors.name}
          hint="Club schedules pick a template for each weekday by this name."
        />

        {locked ? (
          <div className="space-y-3">
            <Alert tone="info">
              These slots have already been in effect, so they can’t change anymore. You
              can still rename the template — or create a new one for a different day.
            </Alert>
            <p className="text-sm text-fog">{summarizeSlots(slots)}</p>
            <ul aria-label="Slots" className="flex flex-wrap gap-2">
              {slots.map((slot) => (
                <li key={slot.start}>
                  <Badge tone="neutral">
                    {slot.start}–{slot.end}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <fieldset className="space-y-4 border border-line/15 p-4">
              <legend className="px-1 text-sm font-medium text-mist">Fill the day</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Opens"
                  options={START_OPTIONS}
                  value={fill.open}
                  onChange={(open) =>
                    setFill((current) => ({ ...current, open: open || current.open }))
                  }
                  clearable={false}
                  searchPlaceholder="Search times…"
                />
                <Select
                  label="Closes"
                  options={END_OPTIONS}
                  value={fill.close}
                  onChange={(close) =>
                    setFill((current) => ({ ...current, close: close || current.close }))
                  }
                  clearable={false}
                  searchPlaceholder="Search times…"
                />
              </div>
              <FilterGroup
                label="Slot length"
                aria-label="Slot length"
                options={SLOT_LENGTHS.map((minutes) => ({
                  value: String(minutes),
                  label: `${minutes} min`,
                }))}
                value={String(fill.minutes)}
                onChange={(value) =>
                  setFill((current) => ({ ...current, minutes: Number(value) }))
                }
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" size="sm" onClick={fillDay}>
                  Fill slots
                </Button>
                <p className="text-xs text-fog">
                  {gridSlots(fill.open, fill.close, fill.minutes).length} slots — replaces
                  the list below.
                </p>
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-mist">Slots</legend>
              <p className="text-sm text-fog">
                {summarizeSlots(slots)}. Times are the club’s local time; 24:00 is
                midnight.
              </p>
              {slots.length ? (
                <div
                  aria-hidden
                  className="grid grid-cols-[1fr_1fr_auto] gap-3 text-xs font-medium tracking-wide text-fog uppercase"
                >
                  <span>Start</span>
                  <span>End</span>
                  <span className="w-[4.5rem]" />
                </div>
              ) : null}
              <ol className="space-y-3">
                {slots.map((slot, index) => (
                  <li key={index} className="space-y-1">
                    <div className="grid grid-cols-[1fr_1fr_auto] items-start gap-3">
                      <Select
                        hideLabel
                        label={`Slot ${index + 1} start`}
                        options={START_OPTIONS}
                        value={slot.start}
                        onChange={(start) => start && updateSlot(index, { start })}
                        clearable={false}
                        searchPlaceholder="Search times…"
                        triggerClassName="pr-10"
                      />
                      <Select
                        hideLabel
                        label={`Slot ${index + 1} end`}
                        options={END_OPTIONS}
                        value={slot.end}
                        onChange={(end) => end && updateSlot(index, { end })}
                        clearable={false}
                        searchPlaceholder="Search times…"
                        triggerClassName="pr-10"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-[4.5rem] py-3"
                        aria-label={`Remove slot ${index + 1} (${slot.start}–${slot.end})`}
                        onClick={() =>
                          setSlots((current) => current.filter((_, i) => i !== index))
                        }
                      >
                        Remove
                      </Button>
                    </div>
                    {showSlotErrors && slotErrors[index] ? (
                      <p className="text-sm text-clay">{slotErrors[index]}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
              {serverErrors.slots ? (
                <p className="text-sm text-clay">{serverErrors.slots}</p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={addSlot}
                  disabled={!nextSlot(slots)}
                >
                  Add slot
                </Button>
                {slots.length ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSlots(sortSlots(slots))}
                  >
                    Sort by time
                  </Button>
                ) : null}
              </div>
              {slots.length === 0 ? (
                <p className="text-xs text-fog">
                  A template without slots closes the courts on the days that use it.
                </p>
              ) : null}
            </fieldset>
          </>
        )}

        {serverErrors.general ? <Alert>{serverErrors.general}</Alert> : null}
        {conflicts.length ? (
          <div className="space-y-2 border border-clay/40 p-4">
            <p className="text-sm text-mist">
              Saving anyway cancels these bookings. CourtControl doesn’t notify the
              players — let them know.
            </p>
            <ul
              aria-label="Bookings that would be cancelled"
              className="list-disc space-y-1 pl-5 text-sm text-line"
            >
              {conflicts.map((booking) => (
                <li key={booking.id}>{describeBooking(booking)}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </form>
    </Modal>
  )
}
