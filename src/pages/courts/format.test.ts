import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api/client'
import {
  clockTime,
  clubTimeZoneHint,
  courtFeatures,
  courtPricing,
  dayLabel,
  describeCourtsError,
  formatDay,
  groupSlotsByDay,
  groupCourtsByClub,
  isSessionError,
  noticeLabel,
  plural,
  slotLabel,
  surfaceLabel,
  todayIn,
  uniqueCourts,
} from '@/pages/courts/format'
import { makeClub, makeCourt } from '@/test/factories'

describe('labels', () => {
  it('maps known surfaces and humanizes unknown ones', () => {
    expect(surfaceLabel('CLAY')).toBe('Clay')
    expect(surfaceLabel('SYNTHETIC')).toBe('Synthetic')
    expect(surfaceLabel('ARTIFICIAL_GRASS')).toBe('Artificial grass')
  })

  it('maps notice types, using a neutral label for OTHER', () => {
    expect(noticeLabel('TOURNAMENT')).toBe('Tournament')
    expect(noticeLabel('OTHER')).toBe('Notice')
    expect(noticeLabel('CLUB_PARTY')).toBe('Club party')
  })

  it('describes court features', () => {
    expect(courtFeatures(makeCourt())).toBe('Clay · Outdoor · Lighting')
    expect(
      courtFeatures(
        makeCourt({ surface_type: 'HARD', is_indoor: true, has_lighting: false }),
      ),
    ).toBe('Hard · Indoor · No lighting')
  })

  it('pluralizes', () => {
    expect(plural(1, 'court')).toBe('1 court')
    expect(plural(0, 'court')).toBe('0 courts')
    expect(plural(3, 'club')).toBe('3 clubs')
  })
})

describe('courtPricing', () => {
  it('shows the hourly rate and the lighting fee', () => {
    expect(
      courtPricing(makeCourt({ hourly_rate: '120.00', lighting_fee: '30.00' })),
    ).toBe('120.00 / hour · +30.00 lighting')
  })

  it('formats large amounts with separators', () => {
    expect(courtPricing(makeCourt({ hourly_rate: '1250.5', lighting_fee: '0.00' }))).toBe(
      '1,250.50 / hour',
    )
  })

  it('omits the lighting fee when it is zero or the court has no lighting', () => {
    expect(courtPricing(makeCourt({ lighting_fee: '0.00' }))).toBe('120.00 / hour')
    expect(courtPricing(makeCourt({ has_lighting: false, lighting_fee: '30.00' }))).toBe(
      '120.00 / hour',
    )
  })

  it('returns null when no rate is set or it is not a number', () => {
    expect(courtPricing(makeCourt({ hourly_rate: '0.00' }))).toBeNull()
    expect(courtPricing(makeCourt({ hourly_rate: 'n/a' }))).toBeNull()
  })
})

describe('slot times', () => {
  it('keeps the club-local wall-clock time from the ISO offset timestamp', () => {
    expect(clockTime('2030-01-08T08:00:00-03:00')).toBe('08:00')
    expect(clockTime('2030-01-08T20:30:00+00:00')).toBe('20:30')
  })

  it('falls back to the raw value when it is not an ISO timestamp', () => {
    expect(clockTime('soon')).toBe('soon')
  })

  it('labels a slot as a range', () => {
    expect(
      slotLabel({ start: '2030-01-08T18:00:00-03:00', end: '2030-01-08T19:30:00-03:00' }),
    ).toBe('18:00–19:30')
  })
})

describe('clubTimeZoneHint', () => {
  it('is empty when the club shares the viewer timezone', () => {
    expect(
      clubTimeZoneHint(makeClub({ timezone: 'America/Sao_Paulo' }), 'America/Sao_Paulo'),
    ).toBeNull()
  })

  it('names the club city when timezones differ', () => {
    expect(
      clubTimeZoneHint(makeClub({ timezone: 'Europe/Lisbon' }), 'America/Sao_Paulo'),
    ).toBe('Slots in Lisbon time')
    expect(
      clubTimeZoneHint(makeClub({ timezone: 'America/New_York' }), 'America/Sao_Paulo'),
    ).toBe('Slots in New York time')
  })
})

describe('grouping', () => {
  it('groups by club in API order', () => {
    const jardins = makeClub({ name: 'Jardins Country Club' })
    const lisboa = makeClub({ name: 'Lisboa Tennis Club' })
    const a = makeCourt({ club: jardins, name: 'A' })
    const b = makeCourt({ club: jardins, name: 'B' })
    const c = makeCourt({ club: lisboa, name: 'C' })

    const groups = groupCourtsByClub([a, b, c])

    expect(groups.map((group) => group.club.name)).toEqual([
      'Jardins Country Club',
      'Lisboa Tennis Club',
    ])
    expect(groups[0].courts).toEqual([a, b])
    expect(groups[1].courts).toEqual([c])
  })

  it('drops courts repeated across pages', () => {
    const a = makeCourt()
    const b = makeCourt()
    expect(uniqueCourts([a, b, a])).toEqual([a, b])
  })
})

describe('describeCourtsError', () => {
  it('treats 401/403 as an expired session', () => {
    expect(isSessionError(new ApiError('nope', 403))).toBe(true)
    expect(isSessionError(new ApiError('nope', 401))).toBe(true)
    expect(isSessionError(new ApiError('nope', 404))).toBe(false)
    expect(describeCourtsError(new ApiError('Forbidden', 403))).toMatch(
      /session has expired/i,
    )
  })

  it('explains server errors without leaking internals', () => {
    expect(describeCourtsError(new ApiError('Traceback…', 500))).toBe(
      "CourtControl couldn't load courts right now (500). Try again in a moment.",
    )
  })

  it('shows API detail messages for other failures', () => {
    expect(describeCourtsError(new ApiError('Invalid page.', 404))).toBe('Invalid page.')
  })

  it('explains network failures', () => {
    expect(describeCourtsError(new TypeError('Failed to fetch'))).toMatch(
      /can't reach courtcontrol/i,
    )
  })

  it('falls back to a generic message', () => {
    expect(describeCourtsError(new Error('boom'))).toBe(
      'Something went wrong while loading courts. Try again.',
    )
  })
})

describe('days', () => {
  it('formats ISO dates for display', () => {
    expect(formatDay('2030-01-08')).toBe('Tue, Jan 8')
    expect(formatDay('nonsense')).toBe('nonsense')
  })

  it('labels yesterday, and adds the year for other years', () => {
    expect(dayLabel('2030-01-30', '2030-01-31')).toBe('Yesterday')
    expect(dayLabel('2029-12-31', '2030-01-01')).toBe('Yesterday')
    expect(dayLabel('2029-11-09', '2030-01-31')).toBe('Fri, Nov 9, 2029')
    expect(dayLabel('2031-01-01', '2030-12-31')).toBe('Tomorrow')
    expect(dayLabel('2031-02-01', '2030-12-31')).toBe('Sat, Feb 1, 2031')
  })

  it('labels today and tomorrow relative to a given day, across month ends', () => {
    expect(dayLabel('2030-01-31', '2030-01-31')).toBe('Today')
    expect(dayLabel('2030-02-01', '2030-01-31')).toBe('Tomorrow')
    expect(dayLabel('2030-02-02', '2030-01-31')).toBe('Sat, Feb 2')
  })

  it("computes today's date in a timezone", () => {
    // 01:30 UTC is still the previous evening in São Paulo.
    const now = new Date('2030-01-09T01:30:00Z')
    expect(todayIn('UTC', now)).toBe('2030-01-09')
    expect(todayIn('America/Sao_Paulo', now)).toBe('2030-01-08')
    expect(todayIn('Not/AZone', now)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('groups slots by their club-local day', () => {
    const slot = (start: string) => ({ start, end: start })
    const a = slot('2030-01-08T20:00:00-03:00')
    const b = slot('2030-01-08T21:00:00-03:00')
    const c = slot('2030-01-09T08:00:00-03:00')
    expect(groupSlotsByDay([a, b, c])).toEqual([
      { date: '2030-01-08', slots: [a, b] },
      { date: '2030-01-09', slots: [c] },
    ])
    expect(groupSlotsByDay([])).toEqual([])
  })
})
