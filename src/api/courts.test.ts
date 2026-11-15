import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api/client'
import { fetchBookableClubs, fetchCourts } from '@/api/courts'
import { makeClub, makeCourt, makePage } from '@/test/factories'
import { jsonResponse, mockFetch, requestedUrls } from '@/test/fetch'

describe('fetchCourts', () => {
  it('requests the first page with the session cookie', async () => {
    const page = makePage([makeCourt()])
    const fetchMock = mockFetch(() => jsonResponse(page))

    await expect(fetchCourts()).resolves.toEqual(page)

    expect(requestedUrls(fetchMock)).toEqual(['/api/v1/courts/'])
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      credentials: 'include',
    })
  })

  it('requests later pages by page number', async () => {
    const fetchMock = mockFetch(() => jsonResponse(makePage([], { page: 2 })))

    await fetchCourts({}, 2)

    expect(requestedUrls(fetchMock)).toEqual(['/api/v1/courts/?page=2'])
  })

  it('raises the API detail and status on errors', async () => {
    mockFetch(() => jsonResponse({ detail: 'Invalid page.' }, 404))

    const error = await fetchCourts({}, 9).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ message: 'Invalid page.', status: 404 })
  })

  it('rejects a payload that is not a courts page', async () => {
    mockFetch(() => jsonResponse({ status: 'ok' }))

    await expect(fetchCourts()).rejects.toThrow(/unexpected courts response/i)
  })

  it('rejects a non-JSON success body', async () => {
    mockFetch(
      () => new Response('<!doctype html><title>Other app</title>', { status: 200 }),
    )

    await expect(fetchCourts()).rejects.toThrow(/unexpected courts response/i)
  })

  it('sends filter params, skipping blank ones', async () => {
    const fetchMock = mockFetch(() => jsonResponse(makePage([])))

    await fetchCourts(
      { surface_type: 'CLAY,HARD', date: '2030-01-08', club: '', time_to: undefined },
      2,
    )

    expect(requestedUrls(fetchMock)).toEqual([
      '/api/v1/courts/?surface_type=CLAY%2CHARD&date=2030-01-08&page=2',
    ])
  })
})

describe('fetchBookableClubs', () => {
  it('walks every page of the unfiltered list and returns unique clubs by name', async () => {
    const morumbi = makeClub({ name: 'Morumbi Racquet Club' })
    const jardins = makeClub({ name: 'Jardins Country Club' })
    const lisboa = makeClub({ name: 'Lisboa Tennis Club' })
    const fetchMock = mockFetch((url) =>
      url.searchParams.get('page') === '2'
        ? jsonResponse(makePage([makeCourt({ club: lisboa })], { count: 3, page: 2 }))
        : jsonResponse(
            makePage(
              [
                makeCourt({ club: morumbi }),
                makeCourt({ club: jardins }),
                makeCourt({ club: morumbi }),
              ],
              {
                count: 4,
                hasNext: true,
              },
            ),
          ),
    )

    const clubs = await fetchBookableClubs()

    expect(clubs.map((club) => club.name)).toEqual([
      'Jardins Country Club',
      'Lisboa Tennis Club',
      'Morumbi Racquet Club',
    ])
    expect(requestedUrls(fetchMock)).toEqual([
      '/api/v1/courts/',
      '/api/v1/courts/?page=2',
    ])
  })
})
