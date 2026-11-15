import { createContext, useContext } from 'react'

import type { WorkingClub } from '@/api/me'
import type { ActingRole, Workspace } from '@/workspace/workspace'

export type WorkspaceContextValue = {
  /** The current workspace; null until the user picks one (or it went stale). */
  workspace: Workspace | null
  /** The club being worked in (club workspaces only). */
  club: WorkingClub | null
  /** The role acted with in that club (club workspaces only). */
  role: ActingRole | null
  setWorkspace: (workspace: Workspace | null) => void
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return context
}
