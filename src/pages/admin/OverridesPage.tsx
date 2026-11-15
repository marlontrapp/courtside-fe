import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'

import {
  clubCourtsQueryKey,
  clubOverridesQueryKey,
  deleteCourtOverride,
  fetchClubCourts,
  fetchClubOverrides,
  type AffectedBooking,
  type CourtOverride,
} from '@/api/clubs'
import { playerDisplayName } from '@/api/reservations'
import { useAuth } from '@/auth/auth-context'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { EmptyState } from '@/components/EmptyState'
import { Modal } from '@/components/Modal'
import { PageHeader } from '@/components/PageHeader'
import { Spinner } from '@/components/Spinner'
import { OverrideModal } from '@/pages/admin/OverrideModal'
import { overrideErrors } from '@/pages/admin/overrideErrors'
import {
  clockTime,
  describeLoadError,
  formatDay,
  isSessionError,
  noticeLabel,
  plural,
  slotDay,
} from '@/pages/courts/format'
import { useWorkspace } from '@/workspace/workspace-context'

type Notice = { text: string; cancelled: AffectedBooking[] } | null

function overrideSummary(override: CourtOverride): string {
  const slots = override.day_template
    ? override.slots.length
      ? `${override.slots[0]!.start}–${override.slots.at(-1)!.end}`
      : override.day_template.name
    : 'Closed'
  return `${noticeLabel(override.type)} · ${slots}`
}

/** One-day schedule overrides across the club’s courts. */
export function OverridesPage() {
  const { refresh: refreshSession } = useAuth()
  const { club } = useWorkspace()
  const clubId = club?.id ?? ''
  const [editing, setEditing] = useState<CourtOverride | null | 'new'>(null)
  const [deleting, setDeleting] = useState<CourtOverride | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const noticeRef = useRef<HTMLDivElement>(null)

  const courtsQuery = useQuery({
    queryKey: clubCourtsQueryKey(clubId),
    queryFn: () => fetchClubCourts(clubId),
    enabled: Boolean(club),
  })

  const overridesQuery = useQuery({
    queryKey: clubOverridesQueryKey(clubId),
    queryFn: () => fetchClubOverrides(courtsQuery.data ?? []),
    enabled: Boolean(club) && courtsQuery.isSuccess,
  })

  const sessionExpired =
    (courtsQuery.isError && isSessionError(courtsQuery.error)) ||
    (overridesQuery.isError && isSessionError(overridesQuery.error))
  useEffect(() => {
    if (sessionExpired) void refreshSession()
  }, [sessionExpired, refreshSession])

  useEffect(() => {
    if (notice) noticeRef.current?.focus()
  }, [notice])

  const overrides = overridesQuery.data ?? []
  const courts = courtsQuery.data ?? []
  const byDate = useMemo(() => {
    const groups: Array<{ date: string; items: CourtOverride[] }> = []
    for (const override of overrides) {
      const last = groups.at(-1)
      if (last && last.date === override.date) last.items.push(override)
      else groups.push({ date: override.date, items: [override] })
    }
    return groups
  }, [overrides])

  if (!club) return null

  const loading = courtsQuery.isPending || overridesQuery.isPending
  const loadError = courtsQuery.error ?? overridesQuery.error
  const newOverride = () => setEditing('new')

  let content
  if (loading) {
    content = <Spinner label="Loading overrides…" />
  } else if (loadError) {
    content = (
      <div className="space-y-4">
        <Alert>{describeLoadError(loadError, 'the overrides')}</Alert>
        <Button
          variant="secondary"
          onClick={() => {
            void courtsQuery.refetch()
            void overridesQuery.refetch()
          }}
          disabled={courtsQuery.isFetching || overridesQuery.isFetching}
        >
          {courtsQuery.isFetching || overridesQuery.isFetching ? 'Retrying…' : 'Try again'}
        </Button>
      </div>
    )
  } else if (courts.length === 0) {
    content = (
      <EmptyState
        title="Add a court first"
        description="Overrides change one date or a range for one or more courts. Create a court, then come back here."
      />
    )
  } else if (overrides.length === 0) {
    content = (
      <EmptyState
        title="No upcoming overrides"
        description="Close a court for weather, swap in a tournament template, or mark a holiday — for one day or a range, on one court or many."
        action={<Button onClick={newOverride}>New override</Button>}
      />
    )
  } else {
    content = (
      <div className="space-y-8">
        {byDate.map((group) => (
          <section key={group.date} className="space-y-3" aria-labelledby={`day-${group.date}`}>
            <h2
              id={`day-${group.date}`}
              className="font-display text-xl tracking-tight text-line"
            >
              {formatDay(group.date)}
            </h2>
            <ul className="space-y-3">
              {group.items.map((override) => (
                <li key={`${override.courtId}-${override.date}`}>
                  <OverrideCard
                    override={override}
                    onEdit={() => setEditing(override)}
                    onDelete={() => setDeleting(override)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Schedules"
        title="Overrides"
        description={`Date overrides at ${club.name} — weather, tournaments, holidays — for one court or several, one day or a range.`}
        actions={
          courts.length && overrides.length ? (
            <Button onClick={newOverride}>New override</Button>
          ) : null
        }
      />

      <div className="fade-up mx-auto mt-10 w-full max-w-3xl space-y-6 [animation-delay:120ms]">
        {notice ? (
          <div ref={noticeRef} tabIndex={-1} className="space-y-2 outline-none">
            <Alert tone="success">{notice.text}</Alert>
            {notice.cancelled.length ? (
              <div className="space-y-2 border border-clay/40 p-4">
                <p className="text-sm text-mist">
                  These bookings were cancelled. CourtControl doesn’t notify the players —
                  let them know:
                </p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-line">
                  {notice.cancelled.map((booking) => (
                    <li key={booking.id}>
                      {formatDay(slotDay(booking.start))}, {clockTime(booking.start)}–
                      {clockTime(booking.end)} · {booking.court_name} ·{' '}
                      {playerDisplayName(booking.primary_player)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
        {content}
      </div>

      {editing !== null ? (
        <OverrideModal
          clubId={clubId}
          clubTimezone={club.timezone}
          courts={courts}
          editing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={({ cancelled, courtCount, dayCount }) => {
            setEditing(null)
            const courtsText = plural(courtCount, 'court')
            const text =
              dayCount > 1
                ? `Saved override on ${courtsText} across ${plural(dayCount, 'day')}.`
                : `Saved override on ${courtsText}.`
            setNotice({ text, cancelled })
          }}
        />
      ) : null}

      <DeleteOverrideModal
        clubId={clubId}
        override={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={(override, cancelled) => {
          setDeleting(null)
          setNotice({
            text: `Removed override on ${override.courtName} for ${formatDay(override.date)}.`,
            cancelled,
          })
        }}
      />
    </>
  )
}

function OverrideCard({
  override,
  onEdit,
  onDelete,
}: {
  override: CourtOverride
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Card role="article" aria-label={`${override.courtName} · ${override.date}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium tracking-wide break-words text-line uppercase">
            {override.courtName}
          </h3>
          <p className="mt-1 text-sm text-mist">{overrideSummary(override)}</p>
          {override.notes ? (
            <p className="mt-1 text-sm text-fog">“{override.notes}”</p>
          ) : null}
        </div>
        <Badge tone="neutral">{noticeLabel(override.type)}</Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-line/10 pt-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={onEdit}
          aria-label={`Edit override for ${override.courtName}`}
        >
          Edit
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={onDelete}
          aria-label={`Delete override for ${override.courtName}`}
        >
          Remove
        </Button>
      </div>
    </Card>
  )
}

function DeleteOverrideModal({
  clubId,
  override,
  onClose,
  onDeleted,
}: {
  clubId: string
  override: CourtOverride | null
  onClose: () => void
  onDeleted: (override: CourtOverride, cancelled: AffectedBooking[]) => void
}) {
  const queryClient = useQueryClient()
  const keepRef = useRef<HTMLButtonElement>(null)
  const [conflicts, setConflicts] = useState<AffectedBooking[]>([])
  const mutation = useMutation({
    mutationFn: async ({
      target,
      force,
    }: {
      target: CourtOverride
      force: boolean
    }) => {
      const cancelled = await deleteCourtOverride(target.courtId, target.date, { force })
      return { target, cancelled }
    },
    onSuccess: ({ target, cancelled }) => {
      setConflicts([])
      void queryClient.invalidateQueries({ queryKey: clubOverridesQueryKey(clubId) })
      void queryClient.invalidateQueries({
        queryKey: ['courts', target.courtId, 'overrides'],
      })
      mutation.reset()
      onDeleted(target, cancelled)
    },
    onError: (error) => {
      const mapped = overrideErrors(error)
      setConflicts(mapped.conflicts ?? [])
    },
  })
  const errors = mutation.isError ? overrideErrors(mutation.error) : {}
  const close = () => {
    if (mutation.isPending) return
    setConflicts([])
    mutation.reset()
    onClose()
  }

  return (
    <Modal
      open={override !== null}
      title="Remove override?"
      onClose={close}
      initialFocusRef={keepRef}
      footer={
        <>
          <Button
            ref={keepRef}
            variant="ghost"
            onClick={close}
            disabled={mutation.isPending}
          >
            Keep it
          </Button>
          {conflicts.length ? (
            <Button
              variant="danger"
              onClick={() =>
                override && mutation.mutate({ target: override, force: true })
              }
              disabled={mutation.isPending}
            >
              {mutation.isPending
                ? 'Removing…'
                : `Cancel ${conflicts.length === 1 ? '1 booking' : `${conflicts.length} bookings`} and remove`}
            </Button>
          ) : (
            <Button
              variant="danger"
              onClick={() =>
                override && mutation.mutate({ target: override, force: false })
              }
              disabled={mutation.isPending || errors.stale}
            >
              {mutation.isPending ? 'Removing…' : 'Remove override'}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <p>
          <span className="font-medium text-line">{override?.courtName}</span> on{' '}
          {override ? formatDay(override.date) : ''} goes back to its weekly schedule.
        </p>
        {errors.general ? <Alert>{errors.general}</Alert> : null}
        {conflicts.length ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-mist">
            {conflicts.map((booking) => (
              <li key={booking.id}>
                {formatDay(slotDay(booking.start))}, {clockTime(booking.start)}–
                {clockTime(booking.end)} · {booking.court_name} ·{' '}
                {playerDisplayName(booking.primary_player)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Modal>
  )
}
