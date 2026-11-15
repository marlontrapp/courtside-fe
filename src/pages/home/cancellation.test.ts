import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api/client'
import { cancelErrors } from '@/pages/home/cancellation'

describe('cancelErrors', () => {
  it("passes on CourtControl's reason when it's too late (409), and stops retries", () => {
    const detail =
      'The cancellation deadline has passed: Open Club allows cancelling up to 24 hours before the start (deadline was 2030-01-08 18:00).'
    expect(cancelErrors(new ApiError(detail, 409))).toEqual({
      general: detail,
      final: true,
      stale: true,
    })
  })

  it('tells a signed-out 403 apart from a guest trying to cancel', () => {
    expect(
      cancelErrors(new ApiError('Authentication credentials were not provided.', 403)),
    ).toMatchObject({ sessionExpired: true })
    expect(cancelErrors(new ApiError('x', 401))).toMatchObject({ sessionExpired: true })
    expect(
      cancelErrors(
        new ApiError('Only the player who made the booking can cancel it.', 403),
      ),
    ).toEqual({
      general: 'Only the player who made the booking can cancel it.',
      final: true,
      stale: true,
    })
  })

  it('explains a booking that is gone (404)', () => {
    expect(cancelErrors(new ApiError('Not found.', 404))).toEqual({
      general: 'This booking no longer exists — it may already have been removed.',
      final: true,
      stale: true,
    })
  })

  it('puts reason errors on the field', () => {
    expect(
      cancelErrors(
        new ApiError('x', 400, {
          reason: ['Ensure this field has no more than 500 characters.'],
        }),
      ),
    ).toEqual({ reason: 'Ensure this field has no more than 500 characters.' })
  })

  it('lets the user retry server and network failures (cancelling is idempotent)', () => {
    expect(cancelErrors(new ApiError('x', 502))).toEqual({
      general:
        "CourtControl couldn't cancel the booking right now (502). Try again in a moment.",
    })
    expect(cancelErrors(new TypeError('Failed to fetch'))).toEqual({
      general: "Can't reach CourtControl. Check your connection and try again.",
    })
    expect(cancelErrors(new Error('boom'))).toEqual({
      general: 'Something went wrong while cancelling. Try again.',
    })
  })

  it("doesn't invite a retry when the cancellation went through but the reply was odd", () => {
    expect(
      cancelErrors(new ApiError('Your booking was cancelled, but …', 0)),
    ).toMatchObject({
      final: true,
      stale: true,
    })
  })
})
