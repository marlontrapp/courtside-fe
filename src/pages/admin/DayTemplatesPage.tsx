import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import {
  dayTemplatesQueryKey,
  deleteDayTemplate,
  fetchDayTemplates,
  type AffectedBooking,
  type DayTemplate,
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
import {
  clockTime,
  describeLoadError,
  formatDay,
  isSessionError,
  slotDay,
} from '@/pages/courts/format'
import { DayTemplateModal } from '@/pages/admin/DayTemplateModal'
import { summarizeSlots, templateErrors } from '@/pages/admin/templateSlots'
import { useWorkspace } from '@/workspace/workspace-context'

type Editing = { template: DayTemplate | null } | null

type Notice = { text: string; cancelled: AffectedBooking[] } | null

/** A club's day templates: the slot lists its courts' weekly schedules use. */
export function DayTemplatesPage() {
  const { refresh: refreshSession } = useAuth()
  const { club } = useWorkspace()
  const clubId = club?.id ?? ''
  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<DayTemplate | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const noticeRef = useRef<HTMLDivElement>(null)

  const query = useQuery({
    queryKey: dayTemplatesQueryKey(clubId),
    queryFn: () => fetchDayTemplates(clubId),
    enabled: Boolean(club),
  })

  const sessionExpired = query.isError && isSessionError(query.error)
  useEffect(() => {
    if (sessionExpired) void refreshSession()
  }, [sessionExpired, refreshSession])

  // The edited/deleted card may be gone: move focus to the outcome.
  useEffect(() => {
    if (notice) noticeRef.current?.focus()
  }, [notice])

  if (!club) return null
  const templates = query.data ?? []
  const newTemplate = () => setEditing({ template: null })

  let content
  if (query.isPending) {
    content = <Spinner label="Loading day templates…" />
  } else if (query.isError) {
    content = (
      <div className="space-y-4">
        <Alert>{describeLoadError(query.error, 'the day templates')}</Alert>
        <Button
          variant="secondary"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          {query.isFetching ? 'Retrying…' : 'Try again'}
        </Button>
      </div>
    )
  } else if (templates.length === 0) {
    content = (
      <EmptyState
        title="No day templates yet"
        description="A day template is a named list of time slots — say, “Weekdays: 07:00–22:00, hourly”. Court schedules pick one for each weekday."
        action={<Button onClick={newTemplate}>New template</Button>}
      />
    )
  } else {
    content = (
      <ul className="space-y-3">
        {templates.map((template) => (
          <li key={template.id}>
            <TemplateCard
              template={template}
              onEdit={() => setEditing({ template })}
              onDelete={() => setDeleting(template)}
            />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Schedules"
        title="Day templates"
        description={`The slot lists ${club.name}’s court schedules are built from. Times are the club’s local time.`}
        actions={
          templates.length ? <Button onClick={newTemplate}>New template</Button> : null
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

      {editing ? (
        <DayTemplateModal
          clubId={clubId}
          template={editing.template}
          onClose={() => setEditing(null)}
          onSaved={(template, cancelled) => {
            setEditing(null)
            setNotice({
              text: editing.template
                ? `Saved ${template.name}.`
                : `Created ${template.name}.`,
              cancelled,
            })
          }}
        />
      ) : null}

      <DeleteTemplateModal
        clubId={clubId}
        template={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={(template) => {
          setDeleting(null)
          setNotice({ text: `Deleted ${template.name}.`, cancelled: [] })
        }}
      />
    </>
  )
}

function TemplateCard({
  template,
  onEdit,
  onDelete,
}: {
  template: DayTemplate
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Card role="article" aria-label={template.name}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium tracking-wide break-words text-line uppercase">
            {template.name}
          </h2>
          <p className="mt-1 text-sm text-mist">{summarizeSlots(template.slots)}</p>
        </div>
        {template.locked ? (
          <Badge
            tone="muted"
            title="Its slots have been in effect, so they can’t change."
          >
            Slots locked
          </Badge>
        ) : null}
      </div>
      {template.slots.length ? (
        <ul aria-label={`${template.name} slots`} className="mt-4 flex flex-wrap gap-2">
          {template.slots.map((slot) => (
            <li key={slot.start}>
              <Badge tone="neutral">
                {slot.start}–{slot.end}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2 border-t border-line/10 pt-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={onEdit}
          aria-label={`Edit ${template.name}`}
        >
          {template.locked ? 'Rename' : 'Edit'}
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={onDelete}
          aria-label={`Delete ${template.name}`}
        >
          Delete
        </Button>
      </div>
    </Card>
  )
}

function DeleteTemplateModal({
  clubId,
  template,
  onClose,
  onDeleted,
}: {
  clubId: string
  template: DayTemplate | null
  onClose: () => void
  onDeleted: (template: DayTemplate) => void
}) {
  const queryClient = useQueryClient()
  const keepRef = useRef<HTMLButtonElement>(null)
  const mutation = useMutation({
    mutationFn: (target: DayTemplate) => deleteDayTemplate(clubId, target.id),
    onSuccess: (_, target) => {
      void queryClient.invalidateQueries({ queryKey: dayTemplatesQueryKey(clubId) })
      mutation.reset()
      onDeleted(target)
    },
    onError: (error) => {
      if (templateErrors(error).stale) {
        void queryClient.invalidateQueries({ queryKey: dayTemplatesQueryKey(clubId) })
      }
    },
  })
  const errors = mutation.isError ? templateErrors(mutation.error) : {}
  const close = () => {
    if (mutation.isPending) return
    mutation.reset()
    onClose()
  }

  return (
    <Modal
      open={template !== null}
      title="Delete template?"
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
          <Button
            variant="danger"
            onClick={() => template && mutation.mutate(template)}
            disabled={mutation.isPending || errors.stale}
          >
            {mutation.isPending ? 'Deleting…' : 'Delete template'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p>
          <span className="font-medium text-line">{template?.name}</span> will be removed.
          Templates used by a court schedule or a one-time change can’t be deleted.
        </p>
        {errors.general ? <Alert>{errors.general}</Alert> : null}
      </div>
    </Modal>
  )
}
