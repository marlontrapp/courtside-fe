import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api/client'
import {
  EMPTY_FILTERS,
  END_TIMES,
  START_TIMES,
  activeFilterCount,
  describeWindow,
  filtersToSearchParams,
  hasWindow,
  maxRangeEnd,
  parseFilters,
  serverFilterErrors,
  toApiParams,
  validateFilters,
  type CourtFilters,
} from '@/pages/courts/filters'

const CLUB_A = '965e8bf3-8829-46f9-8b2d-4ea6cbc76f5b'
const CLUB_B = 'b6358489-95c0-4eba-ab56-ac6658a13ebf'
const TODAY = '2030-01-08'

const filters = (patch: Partial<CourtFilters>): CourtFilters => ({
  ...EMPTY_FILTERS,
  ...patch,
})

describe('parseFilters', () => {
  it('reads every filter from the URL', () => {
    const params = new URLSearchParams({
      surface: 'CLAY,GRASS',
      setting: 'indoor',
      club: `${CLUB_A},${CLUB_B}`,
      from: '2030-01-09',
      to: '2030-01-11',
      time_from: '18:00',
      time_to: '24:00',
    })

    expect(parseFilters(params)).toEqual({
      surfaces: ['CLAY', 'GRASS'],
      setting: 'indoor',
      clubs: [CLUB_A, CLUB_B],
      dateFrom: '2030-01-09',
      dateTo: '2030-01-11',
      timeFrom: '18:00',
      timeTo: '24:00',
    })
  })

  it('defaults to no filters', () => {
    expect(parseFilters(new URLSearchParams())).toEqual(EMPTY_FILTERS)
  })

  it('drops values the API would reject, keeping the valid ones', () => {
    const params = new URLSearchParams({
      surface: 'clay,MUD,clay',
      setting: 'maybe',
      club: `not-a-uuid,${CLUB_A}`,
      from: '2030-02-30',
      to: '07/01/2030',
      time_from: '25:00',
      time_to: '24:30',
    })

    expect(parseFilters(params)).toEqual({
      ...EMPTY_FILTERS,
      surfaces: ['CLAY'],
      clubs: [CLUB_A],
    })
  })

  it('does not accept 24:00 as an earliest start', () => {
    expect(parseFilters(new URLSearchParams({ time_from: '24:00' })).timeFrom).toBe('')
  })

  it('round-trips through the URL', () => {
    const value = filters({
      surfaces: ['HARD'],
      setting: 'outdoor',
      clubs: [CLUB_B],
      dateFrom: '2030-01-09',
      timeTo: '21:30',
    })
    expect(parseFilters(filtersToSearchParams(value))).toEqual(value)
    expect(filtersToSearchParams(EMPTY_FILTERS).toString()).toBe('')
  })
})

describe('toApiParams', () => {
  it('maps to CourtControl param names and formats', () => {
    expect(
      toApiParams(
        filters({
          surfaces: ['CLAY', 'HARD'],
          setting: 'indoor',
          clubs: [CLUB_A, CLUB_B],
          timeFrom: '18:00',
          timeTo: '21:00',
        }),
      ),
    ).toEqual({
      surface_type: 'CLAY,HARD',
      is_indoor: 'true',
      club: `${CLUB_A},${CLUB_B}`,
      time_from: '18:00',
      time_to: '21:00',
    })
    expect(toApiParams(filters({ setting: 'outdoor' }))).toEqual({ is_indoor: 'false' })
  })

  it('sends nothing without filters (API default: today)', () => {
    expect(toApiParams(EMPTY_FILTERS)).toEqual({})
  })

  it('sends one day as `date` and a range as `date_from` + `date_to`', () => {
    expect(toApiParams(filters({ dateFrom: '2030-01-09' }))).toEqual({
      date: '2030-01-09',
    })
    expect(
      toApiParams(filters({ dateFrom: '2030-01-09', dateTo: '2030-01-09' })),
    ).toEqual({
      date: '2030-01-09',
    })
    expect(
      toApiParams(filters({ dateFrom: '2030-01-09', dateTo: '2030-01-12' })),
    ).toEqual({
      date_from: '2030-01-09',
      date_to: '2030-01-12',
    })
  })
})

describe('activeFilterCount / hasWindow', () => {
  it('counts each filter once (a date range or time window counts as one)', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0)
    expect(
      activeFilterCount(
        filters({
          surfaces: ['CLAY', 'HARD'],
          setting: 'indoor',
          clubs: [CLUB_A],
          dateFrom: TODAY,
          dateTo: '2030-01-10',
          timeFrom: '08:00',
          timeTo: '10:00',
        }),
      ),
    ).toBe(5)
  })

  it('knows when a date/time window is set', () => {
    expect(hasWindow(filters({ surfaces: ['CLAY'] }))).toBe(false)
    expect(hasWindow(filters({ timeTo: '10:00' }))).toBe(true)
    expect(hasWindow(filters({ dateFrom: TODAY }))).toBe(true)
  })
})

describe('validateFilters', () => {
  it('accepts empty filters, today, and a full 7-day range', () => {
    expect(validateFilters(EMPTY_FILTERS, TODAY)).toEqual({})
    expect(validateFilters(filters({ dateFrom: TODAY }), TODAY)).toEqual({})
    expect(
      validateFilters(filters({ dateFrom: TODAY, dateTo: maxRangeEnd(TODAY) }), TODAY),
    ).toEqual({})
    expect(maxRangeEnd(TODAY)).toBe('2030-01-14')
  })

  it('rejects past dates', () => {
    expect(validateFilters(filters({ dateFrom: '2030-01-07' }), TODAY)).toEqual({
      dateFrom: 'Pick today or a later date.',
    })
  })

  it('needs a start date for a range', () => {
    expect(validateFilters(filters({ dateTo: '2030-01-10' }), TODAY)).toEqual({
      dateFrom: 'Pick a start date for the range.',
    })
  })

  it('rejects reversed and too-long ranges', () => {
    expect(
      validateFilters(filters({ dateFrom: '2030-01-10', dateTo: '2030-01-09' }), TODAY),
    ).toEqual({ dateTo: 'Must be on or after the start date.' })
    expect(
      validateFilters(filters({ dateFrom: TODAY, dateTo: '2030-01-15' }), TODAY),
    ).toEqual({ dateTo: 'Ranges can span up to 7 days (until Mon, Jan 14).' })
  })

  it('handles ranges across month ends', () => {
    expect(maxRangeEnd('2030-01-28')).toBe('2030-02-03')
  })

  it('needs the latest end after the earliest start', () => {
    const error = { timeTo: 'Must be after the earliest start.' }
    expect(
      validateFilters(filters({ timeFrom: '10:00', timeTo: '09:00' }), TODAY),
    ).toEqual(error)
    expect(
      validateFilters(filters({ timeFrom: '10:00', timeTo: '10:00' }), TODAY),
    ).toEqual(error)
    expect(
      validateFilters(filters({ timeFrom: '23:30', timeTo: '24:00' }), TODAY),
    ).toEqual({})
  })
})

describe('serverFilterErrors', () => {
  it('maps DRF field errors onto the filter that owns the param', () => {
    const error = new ApiError('x', 400, {
      date: ['Dates in the past are not allowed.'],
      date_to: ['The date range cannot exceed 7 days.'],
      time_to: ['Must be after `time_from`.'],
      surface_type: ['Select a valid choice. MUD is not one of the available choices.'],
      club: ['Enter a valid UUID.'],
    })

    expect(serverFilterErrors(error)).toEqual({
      dateFrom: 'Dates in the past are not allowed.',
      dateTo: 'The date range cannot exceed 7 days.',
      timeTo: 'Must be after time_from.',
      surfaces: 'Select a valid choice. MUD is not one of the available choices.',
      clubs: 'Enter a valid UUID.',
    })
  })

  it('keeps errors without a field as a general message', () => {
    const error = new ApiError('x', 400, {
      non_field_errors: ['Use either `date` or `date_from`/`date_to`, not both.'],
    })
    expect(serverFilterErrors(error)).toEqual({
      general: 'Use either date or date_from/date_to, not both.',
    })
  })

  it('falls back to the error message for a 400 without field errors', () => {
    expect(serverFilterErrors(new ApiError('Bad request', 400))).toEqual({
      general: 'Bad request',
    })
  })

  it('ignores anything that is not a 400', () => {
    expect(serverFilterErrors(new ApiError('Server error', 500))).toEqual({})
    expect(serverFilterErrors(new TypeError('Failed to fetch'))).toEqual({})
  })
})

describe('time options', () => {
  it('offers half hours; the latest end can be midnight', () => {
    expect(START_TIMES).toHaveLength(48)
    expect(START_TIMES[0]).toBe('00:00')
    expect(START_TIMES.at(-1)).toBe('23:30')
    expect(END_TIMES[0]).toBe('00:30')
    expect(END_TIMES.at(-1)).toBe('24:00')
  })
})

describe('describeWindow', () => {
  it('is empty without a date/time window', () => {
    expect(describeWindow(filters({ surfaces: ['CLAY'] }), TODAY)).toBeNull()
  })

  it('describes days and times', () => {
    expect(describeWindow(filters({ timeFrom: '18:00' }), TODAY)).toBe(
      'Courts with a free slot today starting from 18:00.',
    )
    expect(
      describeWindow(filters({ dateFrom: '2030-01-09', timeTo: '12:00' }), TODAY),
    ).toBe('Courts with a free slot on Wed, Jan 9 ending by 12:00.')
    expect(
      describeWindow(
        filters({
          dateFrom: '2030-01-09',
          dateTo: '2030-01-11',
          timeFrom: '18:00',
          timeTo: '21:00',
        }),
        TODAY,
      ),
    ).toBe(
      'Courts with a free slot from Wed, Jan 9 to Fri, Jan 11 between 18:00 and 21:00.',
    )
  })
})
