import { useQuery } from '@tanstack/react-query'
import { useEffect, useId } from 'react'
import { useNavigate } from 'react-router-dom'

import { clubQueryKey, fetchClub, type ClubDetail } from '@/api/clubs'
import { useAuth } from '@/auth/auth-context'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { SelectableCard } from '@/components/Card'
import { PageHeader } from '@/components/PageHeader'
import { Spinner } from '@/components/Spinner'
import { describeLoadError, isSessionError } from '@/pages/courts/format'
import { useWorkspace } from '@/workspace/workspace-context'
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  canManageSchedules,
  rolesIn,
} from '@/workspace/workspace'

function cancellationPolicy(hours: number): string {
  if (hours === 0) return 'Until the booking starts'
  return `Up to ${hours === 1 ? '1 hour' : `${hours} hours`} before the start`
}

/** Label / value pairs in the small-caps style of the booking cards. */
function Facts({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
      {items.map(([term, value]) => (
        <div key={term}>
          <dt className="text-xs font-medium tracking-wide text-fog uppercase">{term}</dt>
          <dd className="mt-1 text-sm text-line">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Home of a club workspace: the club's settings, your roles, and your tools. */
export function ClubOverviewPage() {
  const navigate = useNavigate()
  const { user, refresh: refreshSession } = useAuth()
  const { club, role } = useWorkspace()
  const settingsId = useId()
  const rolesId = useId()
  const toolsId = useId()

  const clubId = club?.id ?? ''
  const query = useQuery({
    queryKey: clubQueryKey(clubId),
    queryFn: () => fetchClub(clubId),
    enabled: Boolean(club),
  })

  const sessionExpired = query.isError && isSessionError(query.error)
  useEffect(() => {
    if (sessionExpired) void refreshSession()
  }, [sessionExpired, refreshSession])

  if (!club || !role || !user) return null
  const detail: ClubDetail | undefined = query.data
  const myRoles = rolesIn(club, user)

  return (
    <>
      <PageHeader
        eyebrow={ROLE_LABELS[role]}
        title={club.name}
        description={club.address || undefined}
      />

      <div className="fade-up mx-auto mt-10 w-full max-w-3xl space-y-12 [animation-delay:120ms]">
        <section aria-labelledby={settingsId} className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2
              id={settingsId}
              className="font-display text-2xl tracking-tight text-line"
            >
              Club settings
            </h2>
            {detail && !detail.is_active ? <Badge tone="muted">Inactive</Badge> : null}
          </div>

          {query.isPending ? (
            <Spinner label="Loading the club…" />
          ) : !detail ? (
            <div className="space-y-4">
              <Alert>{describeLoadError(query.error, 'the club')}</Alert>
              <Button
                variant="secondary"
                onClick={() => void query.refetch()}
                disabled={query.isFetching}
              >
                {query.isFetching ? 'Retrying…' : 'Try again'}
              </Button>
            </div>
          ) : (
            <div className="border border-line/15 p-5">
              <Facts
                items={[
                  [
                    'Access',
                    detail.access_type === 'MEMBERS_ONLY'
                      ? 'Members only'
                      : 'Open to all players',
                  ],
                  ['Timezone', detail.timezone.replace(/_/g, ' ')],
                  ['Cancellations', cancellationPolicy(detail.cancellation_window_hours)],
                  [
                    'Status',
                    detail.is_active
                      ? 'Active — listed for players'
                      : 'Inactive — hidden from players',
                  ],
                ]}
              />
            </div>
          )}
        </section>

        <section aria-labelledby={rolesId} className="space-y-5">
          <h2 id={rolesId} className="font-display text-2xl tracking-tight text-line">
            Your roles here
          </h2>
          <ul className="space-y-3">
            {myRoles.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 bg-ball" />
                <p className="text-sm text-mist">
                  <span className="font-medium text-line">{ROLE_LABELS[item]}</span>
                  {item === role ? (
                    <span className="text-fog"> (acting now)</span>
                  ) : null}{' '}
                  — {ROLE_DESCRIPTIONS[item]}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby={toolsId} className="space-y-5">
          <h2 id={toolsId} className="font-display text-2xl tracking-tight text-line">
            Tools
          </h2>
          {canManageSchedules(role) ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              <li>
                <SelectableCard onClick={() => navigate('/manage/courts')}>
                  <p className="text-sm font-medium tracking-wide text-line uppercase">
                    Courts
                  </p>
                  <p className="mt-1 text-sm text-mist">
                    Add courts, set rates and surfaces, or take them offline.
                  </p>
                </SelectableCard>
              </li>
              <li>
                <SelectableCard onClick={() => navigate('/manage/day-templates')}>
                  <p className="text-sm font-medium tracking-wide text-line uppercase">
                    Day templates
                  </p>
                  <p className="mt-1 text-sm text-mist">
                    The slot lists court schedules are built from: create, rename, adjust.
                  </p>
                </SelectableCard>
              </li>
              <li>
                <SelectableCard onClick={() => navigate('/manage/overrides')}>
                  <p className="text-sm font-medium tracking-wide text-line uppercase">
                    Overrides
                  </p>
                  <p className="mt-1 text-sm text-mist">
                    Close or re-slot one day for one court or several — weather, events, holidays.
                  </p>
                </SelectableCard>
              </li>
            </ul>
          ) : (
            <Alert tone="info">
              Tools for {ROLE_LABELS[role].toLowerCase()} aren’t available yet —
              CourtControl doesn’t grant this role any club operations so far. You can see
              the club’s details here in the meantime.
            </Alert>
          )}
        </section>
      </div>
    </>
  )
}
