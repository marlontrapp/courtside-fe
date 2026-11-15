import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { FilterPanel } from '@/components/FilterPanel'

describe('FilterPanel', () => {
  it('is a region named by its title, holding the controls', () => {
    render(
      <FilterPanel activeCount={0} onClear={() => {}}>
        <label>
          Surface <input />
        </label>
      </FilterPanel>,
    )

    const panel = screen.getByRole('region', { name: 'Filters' })
    expect(within(panel).getByLabelText('Surface')).toBeInTheDocument()
    expect(
      within(panel).queryByRole('button', { name: 'Clear filters' }),
    ).not.toBeInTheDocument()
  })

  it('shows how many filters are active and clears them', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    render(
      <FilterPanel title="Refine" activeCount={2} onClear={onClear}>
        controls
      </FilterPanel>,
    )

    const panel = screen.getByRole('region', { name: 'Refine' })
    expect(within(panel).getByLabelText('2 active')).toHaveTextContent('2')
    await user.click(within(panel).getByRole('button', { name: 'Clear filters' }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('collapses on small screens until asked, unless forced open', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <FilterPanel activeCount={0} onClear={() => {}}>
        controls
      </FilterPanel>,
    )
    const toggle = screen.getByRole('button', { name: 'Show' })
    const body = document.getElementById(toggle.getAttribute('aria-controls')!)!
    expect(toggle).toHaveClass('sm:hidden')
    expect(body).toHaveClass('hidden', 'sm:block')

    await user.click(toggle)
    expect(screen.getByRole('button', { name: 'Hide' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(body).not.toHaveClass('hidden')
    await user.click(screen.getByRole('button', { name: 'Hide' }))

    rerender(
      <FilterPanel activeCount={0} onClear={() => {}} forceOpen>
        controls
      </FilterPanel>,
    )
    expect(body).not.toHaveClass('hidden')
    expect(screen.getByRole('button', { name: 'Hide' })).toBeDisabled()
  })
})
