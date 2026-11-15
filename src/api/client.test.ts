import { describe, expect, it } from 'vitest'

import { ApiError, apiJson } from '@/api/client'
import { jsonResponse, mockFetch } from '@/test/fetch'

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.catch((caught: unknown) => caught)
  if (!(error instanceof ApiError))
    throw new Error(`Expected ApiError, got ${String(error)}`)
  return error
}

describe('apiJson errors', () => {
  it('uses DRF `detail` as the message', async () => {
    mockFetch(() => jsonResponse({ detail: 'Not found.' }, 404))

    const error = await failure(apiJson('/api/v1/x/'))

    expect(error).toMatchObject({ message: 'Not found.', status: 404, fieldErrors: {} })
  })

  it('collects DRF field errors from a 400, using the first as the message', async () => {
    mockFetch(() =>
      jsonResponse(
        {
          date_to: ['The date range cannot exceed 7 days.'],
          time_to: 'Must be after `time_from`.',
        },
        400,
      ),
    )

    const error = await failure(apiJson('/api/v1/courts/'))

    expect(error.status).toBe(400)
    expect(error.message).toBe('The date range cannot exceed 7 days.')
    expect(error.fieldErrors).toEqual({
      date_to: ['The date range cannot exceed 7 days.'],
      time_to: ['Must be after `time_from`.'],
    })
  })

  it('falls back to the status for bodies it cannot read', async () => {
    mockFetch(() => new Response('<h1>Bad Gateway</h1>', { status: 502 }))

    const error = await failure(apiJson('/api/v1/courts/'))

    expect(error).toMatchObject({
      message: 'Request failed (502)',
      status: 502,
      fieldErrors: {},
    })
  })

  it('flattens per-item list errors (e.g. one bad guest email)', async () => {
    document.cookie = 'csrftoken=test-csrf-token' // POSTs send Django's CSRF token
    mockFetch(() =>
      jsonResponse({ guests: { '1': ['Enter a valid email address.'] } }, 400),
    )

    const error = await failure(
      apiJson('/api/v1/reservations/', { method: 'POST', body: {} }),
    )

    expect(error.fieldErrors).toEqual({ guests: ['Enter a valid email address.'] })
    expect(error.message).toBe('Enter a valid email address.')
  })

  it('reads the reason of a 409 conflict', async () => {
    document.cookie = 'csrftoken=test-csrf-token'
    mockFetch(() =>
      jsonResponse(
        { non_field_errors: ['Court already has an overlapping active reservation.'] },
        409,
      ),
    )

    const error = await failure(
      apiJson('/api/v1/reservations/', { method: 'POST', body: {} }),
    )

    expect(error.status).toBe(409)
    expect(error.message).toBe('Court already has an overlapping active reservation.')
  })
})
