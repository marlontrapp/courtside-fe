import { describe, expect, it } from 'vitest'

import { fetchMe } from '@/api/me'
import { makeMe, makeWorkingClub } from '@/test/factories'
import { jsonResponse, mockFetch, requestedUrls } from '@/test/fetch'

describe('fetchMe', () => {
  it('returns the signed-in user with their clubs', async () => {
    const me = makeMe({ clubs: [makeWorkingClub()] })
    const fetchMock = mockFetch(() => jsonResponse(me))

    await expect(fetchMe()).resolves.toEqual(me)
    expect(requestedUrls(fetchMock)).toEqual(['/api/v1/me/'])
  })

  it('returns null when signed out (it doubles as the session probe)', async () => {
    mockFetch(() =>
      jsonResponse({ detail: 'Authentication credentials were not provided.' }, 403),
    )
    await expect(fetchMe()).resolves.toBeNull()
  })

  it('raises other failures and unexpected payloads', async () => {
    mockFetch(() => new Response('', { status: 500 }))
    await expect(fetchMe()).rejects.toMatchObject({ status: 500 })

    mockFetch(() => jsonResponse({ email: 'x' }))
    await expect(fetchMe()).rejects.toThrow(/unexpected account response/i)
  })
})
