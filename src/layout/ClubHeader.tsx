import { useAuth } from '@/auth/auth-context'
import { Select } from '@/components/Select'
import { useWorkspace } from '@/workspace/workspace-context'
import { ROLE_LABELS, roleForClub, roleSummary } from '@/workspace/workspace'

/** Clubs listed before the switcher offers a search box. */
const SEARCH_FROM = 7

/**
 * The club being run, under "Courtside" in the side panel: logo (if any), name
 * and address. With roles in several clubs, the name opens a club switcher
 * listing each club with the user's roles there.
 */
export function ClubHeader() {
  const { user } = useAuth()
  const { club, role, setWorkspace } = useWorkspace()
  if (!user || !club || !role) return null

  const clubs = user.clubs
  const switchTo = (clubId: string) => {
    const next = clubs.find((item) => item.id === clubId)
    if (!next || next.id === club.id) return
    const nextRole = roleForClub(next, user, role)
    if (nextRole) setWorkspace({ kind: 'club', clubId: next.id, role: nextRole })
  }

  return (
    <div className="mt-4 flex items-start gap-3">
      {club.logo_url ? (
        <img
          src={club.logo_url}
          alt=""
          className="h-10 w-10 shrink-0 border border-line/15 bg-ink/40 object-contain"
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-[0.7rem] font-medium tracking-[0.18em] text-fog uppercase">
          {ROLE_LABELS[role]}
        </p>
        {clubs.length > 1 ? (
          <Select
            variant="plain"
            label="Club"
            className="mt-0.5 space-y-0"
            triggerClassName="font-display text-lg leading-snug"
            options={clubs.map((item) => ({
              value: item.id,
              label: item.name,
              description: [roleSummary(item, user), item.is_active ? null : 'Inactive']
                .filter(Boolean)
                .join(' · '),
            }))}
            value={club.id}
            onChange={switchTo}
            clearable={false}
            searchable={clubs.length >= SEARCH_FROM}
            searchPlaceholder="Search clubs…"
          />
        ) : (
          <p className="mt-0.5 font-display text-lg leading-snug break-words text-line">
            {club.name}
          </p>
        )}
        {club.address ? (
          <p className="mt-0.5 text-[0.7rem] leading-snug break-words text-fog">
            {club.address}
          </p>
        ) : null}
      </div>
    </div>
  )
}
