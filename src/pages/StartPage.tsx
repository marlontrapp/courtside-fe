import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type { WorkingClub } from '@/api/me'
import { useAuth } from '@/auth/auth-context'
import { useSignOut } from '@/auth/useSignOut'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { SelectableCard } from '@/components/Card'
import { EmptyState } from '@/components/EmptyState'
import { plural } from '@/pages/courts/format'
import { CourtBackdrop } from '@/layout/CourtBackdrop'
import { useWorkspace } from '@/workspace/workspace-context'
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  actingOptions,
  onlyWorkspace,
  workspaceHome,
  type ActingOption,
  type ActingRole,
  type Workspace,
} from '@/workspace/workspace'

/**
 * After signing in: how the user wants to act — as a player, or with one of
 * their club roles — and, for club work, in which club (one at a time).
 * Steps with a single possible answer are skipped.
 */
export function StartPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { setWorkspace } = useWorkspace()
  const signOut = useSignOut()
  const headingId = useId()

  const options = user ? actingOptions(user) : []
  const clubOptions = options.filter(
    (option): option is Extract<ActingOption, { kind: 'club' }> => option.kind === 'club',
  )
  // One role with several clubs: go straight to picking the club.
  const [role, setRole] = useState<ActingRole | null>(() =>
    options.length === 1 && clubOptions.length === 1 ? clubOptions[0].role : null,
  )
  const roleClubs = clubOptions.find((option) => option.role === role)?.clubs ?? []

  const choose = useCallback(
    (workspace: Workspace) => {
      setWorkspace(workspace)
      navigate(workspaceHome(workspace), { replace: true })
    },
    [setWorkspace, navigate],
  )

  // Nothing to choose: continue straight away.
  const only = useMemo(() => (user ? onlyWorkspace(user) : null), [user])
  useEffect(() => {
    if (only) choose(only)
  }, [only, choose])

  if (!user || only) return null

  return (
    <main className="relative min-h-dvh overflow-hidden bg-ink text-line">
      <CourtBackdrop />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-6 py-16 sm:px-10">
        <div className="fade-up">
          <p className="text-sm font-medium tracking-[0.28em] text-ball uppercase">
            {user.first_name ? `Hi, ${user.first_name}` : 'Courtside'}
          </p>
          <h1
            id={headingId}
            className="mt-4 font-display text-4xl tracking-tight text-line sm:text-5xl"
          >
            {role ? 'Which club are you working at?' : 'How do you want to continue?'}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-mist">
            {role
              ? `As ${ROLE_LABELS[role].toLowerCase()}, you work in one club at a time. You can switch clubs later from the side menu.`
              : 'Pick how you want to use Courtside now. You can change it later.'}
          </p>
        </div>

        <div className="fade-up mt-10 [animation-delay:120ms]">
          {options.length === 0 ? (
            <EmptyState
              title="Nothing to open yet"
              description="Your account has no player profile and no club roles. Ask your club to add you, then sign in again."
              action={
                <Button
                  variant="secondary"
                  onClick={() => signOut.mutate()}
                  disabled={signOut.isPending}
                >
                  {signOut.isPending ? 'Signing out…' : 'Sign out'}
                </Button>
              }
            />
          ) : role ? (
            <ClubChoices
              labelledBy={headingId}
              clubs={roleClubs}
              onChoose={(club) => choose({ kind: 'club', clubId: club.id, role })}
              onBack={options.length > 1 ? () => setRole(null) : undefined}
            />
          ) : (
            <ul aria-labelledby={headingId} className="grid gap-3 sm:grid-cols-2">
              {options.map((option) => (
                <li key={option.kind === 'player' ? 'player' : option.role}>
                  {option.kind === 'player' ? (
                    <SelectableCard onClick={() => choose({ kind: 'player' })}>
                      <p className="text-sm font-medium tracking-wide text-line uppercase">
                        Player
                      </p>
                      <p className="mt-1 text-sm text-mist">
                        Find courts, book, and keep track of your games.
                      </p>
                    </SelectableCard>
                  ) : (
                    <SelectableCard
                      onClick={() =>
                        option.clubs.length === 1
                          ? choose({
                              kind: 'club',
                              clubId: option.clubs[0].id,
                              role: option.role,
                            })
                          : setRole(option.role)
                      }
                    >
                      <p className="text-sm font-medium tracking-wide text-line uppercase">
                        {ROLE_LABELS[option.role]}
                      </p>
                      <p className="mt-1 text-sm text-mist">
                        {ROLE_DESCRIPTIONS[option.role]}
                      </p>
                      <p className="mt-3 text-xs text-fog">
                        {option.clubs.length === 1
                          ? option.clubs[0].name
                          : plural(option.clubs.length, 'club')}
                      </p>
                    </SelectableCard>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  )
}

function ClubChoices({
  labelledBy,
  clubs,
  onChoose,
  onBack,
}: {
  labelledBy: string
  clubs: WorkingClub[]
  onChoose: (club: WorkingClub) => void
  onBack?: () => void
}) {
  return (
    <div className="space-y-5">
      <ul aria-labelledby={labelledBy} className="grid gap-3 sm:grid-cols-2">
        {clubs.map((club) => (
          <li key={club.id}>
            <SelectableCard onClick={() => onChoose(club)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium tracking-wide break-words text-line uppercase">
                    {club.name}
                  </p>
                  {club.address ? (
                    <p className="mt-1 text-xs break-words text-fog">{club.address}</p>
                  ) : null}
                </div>
                {club.is_active ? null : <Badge tone="muted">Inactive</Badge>}
              </div>
            </SelectableCard>
          </li>
        ))}
      </ul>
      {onBack ? (
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Choose another way
        </Button>
      ) : null}
    </div>
  )
}
