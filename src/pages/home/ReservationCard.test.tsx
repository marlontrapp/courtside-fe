import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ReservationCard } from '@/pages/home/ReservationCard'
import { makeReservation } from '@/test/factories'
import { freezeDate } from '@/test/render'

describe('ReservationCard', () => {
  beforeEach(() => freezeDate('2030-01-08T12:00:00-03:00'))
  const now = Date.parse('2030-01-08T12:00:00-03:00')

  it('upcoming: shows the cancellation field and the Cancel button', () => {
    render(
      <ReservationCard reservation={makeReservation()} now={now} onCancel={vi.fn()} />,
    )

    expect(screen.getByText('Cancellation')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cancel booking/ })).toBeEnabled()
  })

  it('history: never offers cancelling, even if a handler is passed', () => {
    render(
      <ReservationCard
        reservation={makeReservation({ state: 'cancelled', status: 'CANCELLED' })}
        now={now}
        onCancel={vi.fn()}
        variant="history"
      />,
    )

    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.queryByText('Cancellation')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Cancel booking/ }),
    ).not.toBeInTheDocument()
  })

  it('history: no live timing badges on a booking that is still running', () => {
    render(
      <ReservationCard
        reservation={makeReservation({
          state: 'cancelled',
          start: '2030-01-08T11:30:00-03:00',
          end: '2030-01-08T12:30:00-03:00',
        })}
        now={now}
        variant="history"
      />,
    )

    expect(screen.queryByText('In progress')).not.toBeInTheDocument()
  })
})
