import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api/client'
import {
  EMPTY_HISTORY_FILTERS,
  activeHistoryFilterCount,
  historyApiParams,
  historyFiltersToSearchParams,
  parseHistoryFilters,
  serverHistoryFilterErrors,
  validateHistoryFilters,
  type HistoryFilters,
} from '@/pages/history/historyFilters'

const filters = (patch: Partial<HistoryFilters>): HistoryFilters => ({
  ...EMPTY_HISTORY_FILTERS,
  ...patch,
})

describe('history filters', () => {
  it('reads every filter from the URL', () => {
    expect(
      parseHistoryFilters(
        new URLSearchParams({
          status: 'cancelled,expired',
          role: 'guest',
          type: 'DOUBLES,LESSON',
          from: '2030-01-01',
          to: '2030-01-31',
        }),
      ),
    ).toEqual({
      states: ['cancelled', 'expired'],
      role: 'guest',
      types: ['DOUBLES', 'LESSON'],
      dateFrom: '2030-01-01',
      dateTo: '2030-01-31',
    })
  })

  it('drops what CourtControl would reject (incl. upcoming states)', () => {
    expect(
      parseHistoryFilters(
        new URLSearchParams({
          status: 'upcoming,Completed,bogus',
          role: 'admin',
          type: 'doubles,PICKLEBALL,TOURNAMENT',
          from: '2030-02-30',
          to: '31/01/2030',
        }),
      ),
    ).toEqual({ ...EMPTY_HISTORY_FILTERS, states: ['completed'], types: ['DOUBLES'] })
  })

  it('round-trips through the URL', () => {
    const value = filters({
      states: ['completed'],
      role: 'owner',
      dateFrom: '2030-01-05',
    })
    expect(parseHistoryFilters(historyFiltersToSearchParams(value))).toEqual(value)
    expect(historyFiltersToSearchParams(EMPTY_HISTORY_FILTERS).toString()).toBe('')
  })

  it('asks for the whole history, newest first, when no status is picked', () => {
    expect(historyApiParams(EMPTY_HISTORY_FILTERS)).toEqual({
      state: 'completed,cancelled,expired',
      ordering: '-start',
    })
  })

  it('maps filters to CourtControl params', () => {
    expect(
      historyApiParams(
        filters({
          states: ['cancelled'],
          role: 'guest',
          types: ['SINGLES', 'DOUBLES'],
          dateFrom: '2030-01-01',
          dateTo: '2030-01-31',
        }),
      ),
    ).toEqual({
      state: 'cancelled',
      ordering: '-start',
      role: 'guest',
      booking_type: 'SINGLES,DOUBLES',
      date_from: '2030-01-01',
      date_to: '2030-01-31',
    })
    // Either side of the range may be open.
    expect(historyApiParams(filters({ dateTo: '2030-01-31' }))).toMatchObject({
      date_to: '2030-01-31',
    })
    expect(historyApiParams(filters({ dateTo: '2030-01-31' }))).not.toHaveProperty(
      'date_from',
    )
  })

  it('counts active filters (a date range counts once)', () => {
    expect(activeHistoryFilterCount(EMPTY_HISTORY_FILTERS)).toBe(0)
    expect(
      activeHistoryFilterCount(
        filters({
          states: ['completed', 'cancelled'],
          role: 'owner',
          types: ['LESSON'],
          dateFrom: '2030-01-01',
          dateTo: '2030-01-02',
        }),
      ),
    ).toBe(4)
  })

  it('rejects a reversed date range before asking the API', () => {
    expect(
      validateHistoryFilters(filters({ dateFrom: '2030-01-10', dateTo: '2030-01-09' })),
    ).toEqual({
      dateTo: 'Must be on or after the start date.',
    })
    expect(
      validateHistoryFilters(filters({ dateFrom: '2030-01-10', dateTo: '2030-01-10' })),
    ).toEqual({})
  })

  it('maps API validation errors onto the filters', () => {
    expect(
      serverHistoryFilterErrors(
        new ApiError('x', 400, {
          date_to: ['Must not be before `date_from`.'],
          booking_type: ['Select a valid choice. X is not one of the available choices.'],
          page: ['Invalid page.'],
        }),
      ),
    ).toEqual({
      dateTo: 'Must not be before date_from.',
      types: 'Select a valid choice. X is not one of the available choices.',
      general: 'Invalid page.',
    })
    expect(serverHistoryFilterErrors(new ApiError('x', 500))).toEqual({})
  })
})
