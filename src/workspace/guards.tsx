import { Navigate, Outlet } from 'react-router-dom'

import { useWorkspace } from '@/workspace/workspace-context'
import { canManageSchedules, workspaceHome } from '@/workspace/workspace'

/** Pages need a workspace: without one (or a stale one), ask how to continue. */
export function RequireWorkspace() {
  const { workspace } = useWorkspace()
  return workspace ? <Outlet /> : <Navigate to="/start" replace />
}

/** Player pages; club workspaces go to their own home. */
export function RequirePlayerWorkspace() {
  const { workspace } = useWorkspace()
  if (workspace && workspace.kind !== 'player') {
    return <Navigate to={workspaceHome(workspace)} replace />
  }
  return <Outlet />
}

/** Club-management pages; players go to their home. */
export function RequireClubWorkspace() {
  const { workspace } = useWorkspace()
  if (workspace && workspace.kind !== 'club') {
    return <Navigate to={workspaceHome(workspace)} replace />
  }
  return <Outlet />
}

/** Schedule tools: club admins and site staff only (CourtControl 404s other roles). */
export function RequireScheduleRole() {
  const { role } = useWorkspace()
  return role && canManageSchedules(role) ? <Outlet /> : <Navigate to="/manage" replace />
}
