import { useCallback, useMemo, useState, type ReactNode } from 'react'

import { useAuth } from '@/auth/auth-context'
import { WorkspaceContext } from '@/workspace/workspace-context'
import {
  isWorkspaceValid,
  loadWorkspace,
  saveWorkspace,
  type Workspace,
} from '@/workspace/workspace'

type Chosen = { userId: string; workspace: Workspace | null }

/** Holds how the signed-in user is acting; restores their last choice after a reload. */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  // What the user picked this session; otherwise what they last picked (storage).
  const [chosen, setChosen] = useState<Chosen | null>(null)

  const stored = useMemo(() => (user ? loadWorkspace(user.id) : null), [user])
  const candidate = user ? (chosen?.userId === user.id ? chosen.workspace : stored) : null
  // A saved choice may be stale: the role ended, the club went away.
  const workspace =
    user && candidate && isWorkspaceValid(candidate, user) ? candidate : null

  const setWorkspace = useCallback(
    (next: Workspace | null) => {
      if (!user) return
      saveWorkspace(user.id, next)
      setChosen({ userId: user.id, workspace: next })
    },
    [user],
  )

  const value = useMemo(() => {
    const club =
      workspace?.kind === 'club'
        ? (user?.clubs.find((item) => item.id === workspace.clubId) ?? null)
        : null
    return {
      workspace,
      club,
      role: workspace?.kind === 'club' ? workspace.role : null,
      setWorkspace,
    }
  }, [workspace, user, setWorkspace])

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
