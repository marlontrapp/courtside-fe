import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import {
  clubCourtsQueryKey,
  deleteClubCourt,
  fetchClubCourts,
  type AffectedBooking,
  type ManagedCourt,
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
import { CourtModal } from '@/pages/admin/CourtModal'
import { courtErrors } from '@/pages/admin/courtErrors'
import {
  clockTime,
  describeLoadError,
  formatAmount,
  formatDay,
  isSessionError,
  slotDay,
  surfaceLabel,
} from '@/pages/courts/format'
import { useWorkspace } from '@/workspace/workspace-context'

type Editing = { court: ManagedCourt | null } | null
type Notice = { text: string; cancelled: AffectedBooking[] } | null

function courtSummary(court: ManagedCourt): string {
  const parts = [
    surfaceLabel(court.surface_type),
    court.is_indoor ? 'Indoor' : 'Outdoor',
    court.is_singles_only ? 'Singles only' : null,
    court.has_lighting ? 'Lighting' : 'No lighting',
    formatAmount(Number(court.hourly_rate)),
  ].filter(Boolean)
  return parts.join(' · ')
}

/** A club's courts: create, edit settings, deactivate, or delete unused ones. */
export function ClubCourtsPage() {
  const { refresh: refreshSession } = useAuth()
  const { club } = useWorkspace()
  const clubId = club?.id ?? ''
  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<ManagedCourt | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const noticeRef = useRef<HTMLDivElement>(null)

  const query = useQuery({
    queryKey: clubCourtsQueryKey(clubId),
    queryFn: () => fetchClubCourts(clubId),
    enabled: Boolean(club),
  })

  const sessionExpired = query.isError && isSessionError(query.error)
  useEffect(() => {
    if (sessionExpired) void refreshSession()
  }, [sessionExpired, refreshSession])

  useEffect(() => {
    if (notice) noticeRef.current?.focus()
  }, [notice])

  if (!club) return null
  const courts = query.data ?? []
  const newCourt = () => setEditing({ court: null })

  let content
  if (query.isPending) {
    content = <Spinner label="Loading courts…" />
  } else if (query.isError) {
    content = (
      <div className="space-y-4">
        <Alert>{describeLoadError(query.error, 'the courts')}</Alert>
        <Button
          variant="secondary"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          {query.isFetching ? 'Retrying…' : 'Try again'}
        </Button>
      </div>
    )
  } else if (courts.length === 0) {
    content = (
      <EmptyState
        title="No courts yet"
        description="Add the courts players can book — name, surface, rates, and whether they’re indoor or singles-only."
        action={<Button onClick={newCourt}>New court</Button>}
      />
    )
  } else {
    content = (
      <ul className="space-y-3">
        {courts.map((court) => (
          <li key={court.id}>
            <CourtCard
              court={court}
              onEdit={() => setEditing({ court })}
              onDelete={() => setDeleting(court)}
            />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Club"
        title="Courts"
        description={`The courts at ${club.name} — create them, set rates, or take them offline.`}
        actions={courts.length ? <Button onClick={newCourt}>New court</Button> : null}
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

      {editing ? (
        <CourtModal
          clubId={clubId}
          clubTimezone={club.timezone}
          court={editing.court}
          onClose={() => setEditing(null)}
          onSaved={(court, cancelled) => {
            setEditing(null)
            setNotice({
              text: editing.court ? `Saved ${court.name}.` : `Created ${court.name}.`,
              cancelled,
            })
          }}
        />
      ) : null}

      <DeleteCourtModal
        clubId={clubId}
        court={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={(court) => {
          setDeleting(null)
          setNotice({ text: `Deleted ${court.name}.`, cancelled: [] })
        }}
        onEditInstead={(court) => {
          setDeleting(null)
          setEditing({ court })
        }}
      />
    </>
  )
}

function CourtCard({
  court,
  onEdit,
  onDelete,
}: {
  court: ManagedCourt
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Card role="article" aria-label={court.name}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium tracking-wide break-words text-line uppercase">
            {court.name}
          </h2>
          <p className="mt-1 text-sm text-mist">{courtSummary(court)}</p>
          {Number(court.lighting_fee) > 0 ? (
            <p className="mt-1 text-sm text-fog">
              Lighting fee {formatAmount(Number(court.lighting_fee))}
            </p>
          ) : null}
        </div>
        {court.is_active ? null : <Badge tone="muted">Inactive</Badge>}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-line/10 pt-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={onEdit}
          aria-label={`Edit ${court.name}`}
        >
          Edit
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={onDelete}
          aria-label={`Delete ${court.name}`}
        >
          Delete
        </Button>
      </div>
    </Card>
  )
}

function DeleteCourtModal({
  clubId,
  court,
  onClose,
  onDeleted,
  onEditInstead,
}: {
  clubId: string
  court: ManagedCourt | null
  onClose: () => void
  onDeleted: (court: ManagedCourt) => void
  onEditInstead: (court: ManagedCourt) => void
}) {
  const queryClient = useQueryClient()
  const keepRef = useRef<HTMLButtonElement>(null)
  const mutation = useMutation({
    mutationFn: ({ target, force }: { target: ManagedCourt; force: boolean }) =>
      deleteClubCourt(clubId, target.id, { force }),
    onSuccess: (_, { target }) => {
      void queryClient.invalidateQueries({ queryKey: clubCourtsQueryKey(clubId) })
      mutation.reset()
      onDeleted(target)
    },
    onError: (error) => {
      if (courtErrors(error).stale) {
        void queryClient.invalidateQueries({ queryKey: clubCourtsQueryKey(clubId) })
      }
    },
  })
  const errors = mutation.isError ? courtErrors(mutation.error) : {}
  const close = () => {
    if (mutation.isPending) return
    mutation.reset()
    onClose()
  }

  return (
    <Modal
      open={court !== null}
      title="Delete court?"
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
          {errors.hasBookings && court ? (
            <Button
              variant="secondary"
              onClick={() => onEditInstead(court)}
              disabled={mutation.isPending}
            >
              Edit instead
            </Button>
          ) : null}
          {errors.linkedRules && court ? (
            <Button
              variant="danger"
              onClick={() => mutation.mutate({ target: court, force: true })}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Deleting…' : 'Unlink rules and delete'}
            </Button>
          ) : (
            <Button
              variant="danger"
              onClick={() => court && mutation.mutate({ target: court, force: false })}
              disabled={mutation.isPending || errors.hasBookings || errors.stale}
            >
              {mutation.isPending ? 'Deleting…' : 'Delete court'}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <p>
          <span className="font-medium text-line">{court?.name}</span> will be removed.
          Courts that already have bookings (even cancelled ones) can’t be deleted —
          deactivate them instead.
        </p>
        {errors.general ? <Alert>{errors.general}</Alert> : null}
      </div>
    </Modal>
  )
}
