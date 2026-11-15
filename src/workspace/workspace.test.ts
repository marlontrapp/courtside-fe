import { afterEach, describe, expect, it } from 'vitest'

import { makeMe, makeWorkingClub } from '@/test/factories'
import {
  actingOptions,
  canManageSchedules,
  isWorkspaceValid,
  loadWorkspace,
  onlyWorkspace,
  roleForClub,
  roleSummary,
  rolesIn,
  saveWorkspace,
  workspaceHome,
} from '@/workspace/workspace'

const jardins = makeWorkingClub({
  id: 'jardins',
  name: 'Jardins',
  roles: ['ADMIN', 'GROUNDSKEEPER'],
})
const lisboa = makeWorkingClub({ id: 'lisboa', name: 'Lisboa', roles: ['FRONT_DESK'] })
const morumbi = makeWorkingClub({ id: 'morumbi', name: 'Morumbi', roles: ['ADMIN'] })

describe('roles', () => {
  it('lists the roles held in a club; site staff without one act as site staff', () => {
    const me = makeMe({ clubs: [jardins] })
    expect(rolesIn(jardins, me)).toEqual(['ADMIN', 'GROUNDSKEEPER'])
    expect(roleSummary(jardins, me)).toBe('Club admin · Groundskeeper')

    const noRole = makeWorkingClub({ roles: [] })
    expect(rolesIn(noRole, makeMe({ is_site_staff: true }))).toEqual(['SITE_STAFF'])
    expect(rolesIn(noRole, makeMe())).toEqual([])
    // Unknown roles from a newer API are ignored.
    expect(rolesIn(makeWorkingClub({ roles: ['COACH', 'ADMIN'] }), makeMe())).toEqual([
      'ADMIN',
    ])
  })

  it('only admins and site staff manage schedules', () => {
    expect(canManageSchedules('ADMIN')).toBe(true)
    expect(canManageSchedules('SITE_STAFF')).toBe(true)
    expect(canManageSchedules('GROUNDSKEEPER')).toBe(false)
    expect(canManageSchedules('FRONT_DESK')).toBe(false)
  })
})

describe('actingOptions', () => {
  it('offers player first, then each role with its clubs', () => {
    const options = actingOptions(makeMe({ clubs: [jardins, lisboa, morumbi] }))

    expect(
      options.map((option) => (option.kind === 'player' ? 'player' : option.role)),
    ).toEqual(['player', 'ADMIN', 'GROUNDSKEEPER', 'FRONT_DESK'])
    const admin = options[1]
    expect(admin.kind === 'club' && admin.clubs.map((club) => club.id)).toEqual([
      'jardins',
      'morumbi',
    ])
  })

  it('leaves out player for accounts without a player profile', () => {
    expect(actingOptions(makeMe({ is_player: false, clubs: [lisboa] }))).toEqual([
      { kind: 'club', role: 'FRONT_DESK', clubs: [lisboa] },
    ])
    expect(actingOptions(makeMe({ is_player: false }))).toEqual([])
  })
})

describe('onlyWorkspace', () => {
  it('picks the one possible workspace', () => {
    expect(onlyWorkspace(makeMe())).toEqual({ kind: 'player' })
    expect(onlyWorkspace(makeMe({ is_player: false, clubs: [lisboa] }))).toEqual({
      kind: 'club',
      clubId: 'lisboa',
      role: 'FRONT_DESK',
    })
  })

  it('returns null when there is a choice to make', () => {
    expect(onlyWorkspace(makeMe({ clubs: [lisboa] }))).toBeNull()
    expect(
      onlyWorkspace(
        makeMe({ is_player: false, clubs: [morumbi, { ...morumbi, id: 'x' }] }),
      ),
    ).toBeNull()
    expect(onlyWorkspace(makeMe({ is_player: false }))).toBeNull()
  })
})

describe('switching and validity', () => {
  const me = makeMe({ clubs: [jardins, lisboa] })

  it('keeps the current role when the new club has it, else takes the first', () => {
    expect(roleForClub(jardins, me, 'GROUNDSKEEPER')).toBe('GROUNDSKEEPER')
    expect(roleForClub(jardins, me, 'FRONT_DESK')).toBe('ADMIN')
    expect(roleForClub(lisboa, me, 'ADMIN')).toBe('FRONT_DESK')
  })

  it('rejects workspaces the user no longer has', () => {
    expect(isWorkspaceValid({ kind: 'player' }, me)).toBe(true)
    expect(isWorkspaceValid({ kind: 'player' }, makeMe({ is_player: false }))).toBe(false)
    expect(isWorkspaceValid({ kind: 'club', clubId: 'jardins', role: 'ADMIN' }, me)).toBe(
      true,
    )
    expect(isWorkspaceValid({ kind: 'club', clubId: 'lisboa', role: 'ADMIN' }, me)).toBe(
      false,
    )
    expect(isWorkspaceValid({ kind: 'club', clubId: 'gone', role: 'ADMIN' }, me)).toBe(
      false,
    )
  })

  it('knows where each workspace starts', () => {
    expect(workspaceHome({ kind: 'player' })).toBe('/')
    expect(workspaceHome({ kind: 'club', clubId: 'x', role: 'ADMIN' })).toBe('/manage')
  })
})

describe('persistence', () => {
  afterEach(() => window.localStorage.clear())

  it('remembers the workspace per user', () => {
    saveWorkspace('u1', { kind: 'club', clubId: 'jardins', role: 'ADMIN' })
    saveWorkspace('u2', { kind: 'player' })

    expect(loadWorkspace('u1')).toEqual({
      kind: 'club',
      clubId: 'jardins',
      role: 'ADMIN',
    })
    expect(loadWorkspace('u2')).toEqual({ kind: 'player' })
    expect(loadWorkspace('u3')).toBeNull()

    saveWorkspace('u1', null)
    expect(loadWorkspace('u1')).toBeNull()
  })

  it('ignores stored values it cannot trust', () => {
    window.localStorage.setItem('courtside.workspace.u1', '{not json')
    window.localStorage.setItem(
      'courtside.workspace.u2',
      JSON.stringify({ kind: 'club', clubId: 'x', role: 'OWNER' }),
    )
    window.localStorage.setItem(
      'courtside.workspace.u3',
      JSON.stringify({ kind: 'club', role: 'ADMIN' }),
    )

    expect(loadWorkspace('u1')).toBeNull()
    expect(loadWorkspace('u2')).toBeNull()
    expect(loadWorkspace('u3')).toBeNull()
  })
})
