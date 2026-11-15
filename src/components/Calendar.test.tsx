import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Calendar, type CalendarProps } from '@/components/Calendar'
import { freezeDate } from '@/test/render'

function Harness(props: Partial<CalendarProps> & { initial?: string }) {
  const { initial = '', onChange, ...rest } = props
  const [value, setValue] = useState(initial)
  return (
    <>
      <Calendar
        {...rest}
        value={value || undefined}
        onChange={(next) => {
          setValue(next)
          onChange?.(next)
        }}
      />
      <button type="button">Elsewhere</button>
    </>
  )
}

const monthTrigger = () => screen.getByRole('button', { name: /^Month:/ })
const yearTrigger = () => screen.getByRole('button', { name: /^Year:/ })
const menu = (name: 'Month' | 'Year') => screen.queryByRole('listbox', { name })

describe('Calendar header', () => {
  beforeEach(() => freezeDate('2030-01-08T12:00:00-03:00'))

  it('shows the visible month and year as menu triggers', () => {
    render(<Harness />)

    expect(monthTrigger()).toHaveTextContent('January')
    expect(monthTrigger()).toHaveAttribute('aria-haspopup', 'listbox')
    expect(monthTrigger()).toHaveAttribute('aria-expanded', 'false')
    expect(yearTrigger()).toHaveTextContent('2030')
    expect(menu('Month')).not.toBeInTheDocument()
  })

  it('jumps to a month in one click', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(monthTrigger())
    const options = within(menu('Month')!).getAllByRole('option')
    expect(options).toHaveLength(12)
    expect(options[0]).toHaveAccessibleName('January')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    // Opens on the current value, ready for the keyboard.
    expect(options[0]).toHaveFocus()

    await user.click(within(menu('Month')!).getByRole('option', { name: 'September' }))

    expect(menu('Month')).not.toBeInTheDocument()
    expect(monthTrigger()).toHaveTextContent('September')
    expect(screen.getByRole('button', { name: '2030-09-15' })).toBeInTheDocument()
    expect(monthTrigger()).toHaveFocus()
  })

  it('jumps years without clicking through months', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(yearTrigger())
    const years = within(menu('Year')!)
      .getAllByRole('option')
      .map((option) => option.textContent?.replace('✓', ''))
    // Ten years either side of today when nothing bounds the range.
    expect(years[0]).toBe('2020')
    expect(years.at(-1)).toBe('2040')

    await user.click(within(menu('Year')!).getByRole('option', { name: '2024' }))

    expect(yearTrigger()).toHaveTextContent('2024')
    expect(monthTrigger()).toHaveTextContent('January')
    expect(screen.getByRole('button', { name: '2024-01-15' })).toBeInTheDocument()
  })

  it('only offers months and years that min/max allow', async () => {
    const user = userEvent.setup()
    render(<Harness min="2030-03-10" max="2031-02-05" />)

    await user.click(yearTrigger())
    expect(
      within(menu('Year')!)
        .getAllByRole('option')
        .map(
          (option) =>
            option.getAttribute('aria-label') ?? option.textContent?.replace('✓', ''),
        ),
    ).toEqual(['2030', '2031'])
    await user.keyboard('{Escape}')

    await user.click(monthTrigger())
    expect(
      within(menu('Month')!).getByRole('option', { name: 'February' }),
    ).toBeDisabled()
    expect(within(menu('Month')!).getByRole('option', { name: 'March' })).toBeEnabled()
    await user.keyboard('{Escape}')

    // Switching year keeps the month when it exists there, else the first allowed one.
    await user.click(yearTrigger())
    await user.click(within(menu('Year')!).getByRole('option', { name: '2031' }))
    expect(monthTrigger()).toHaveTextContent('January')

    await user.click(monthTrigger())
    expect(within(menu('Month')!).getByRole('option', { name: 'March' })).toBeDisabled()
  })

  it('moves to the first month in range when the year has no such month', async () => {
    const user = userEvent.setup()
    // December exists in 2030 but is past `max` in 2031.
    render(<Harness defaultMonth="2030-12-01" min="2030-03-10" max="2031-02-05" />)
    expect(monthTrigger()).toHaveTextContent('December')

    await user.click(yearTrigger())
    await user.click(within(menu('Year')!).getByRole('option', { name: '2031' }))

    expect(yearTrigger()).toHaveTextContent('2031')
    expect(monthTrigger()).toHaveTextContent('January')
  })

  it('keeps the picked day selectable after jumping', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.click(yearTrigger())
    await user.click(within(menu('Year')!).getByRole('option', { name: '2032' }))
    await user.click(monthTrigger())
    await user.click(within(menu('Month')!).getByRole('option', { name: 'June' }))
    await user.click(screen.getByRole('button', { name: '2032-06-11' }))

    expect(onChange).toHaveBeenCalledWith('2032-06-11')
  })

  it('moves through options with the arrow keys', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(monthTrigger())
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(within(menu('Month')!).getByRole('option', { name: 'March' })).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(within(menu('Month')!).getByRole('option', { name: 'February' })).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(monthTrigger()).toHaveTextContent('February')
  })

  it('closes on Escape, an outside click, or a second click on the trigger', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(monthTrigger())
    await user.keyboard('{Escape}')
    expect(menu('Month')).not.toBeInTheDocument()
    expect(monthTrigger()).toHaveFocus()

    await user.click(monthTrigger())
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }))
    expect(menu('Month')).not.toBeInTheDocument()

    await user.click(monthTrigger())
    await user.click(monthTrigger())
    expect(menu('Month')).not.toBeInTheDocument()
  })

  it('shows one menu at a time', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(monthTrigger())
    await user.click(yearTrigger())

    expect(menu('Month')).not.toBeInTheDocument()
    expect(menu('Year')).toBeInTheDocument()
  })

  it('still steps one month at a time with the arrows', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Previous month' }))

    expect(monthTrigger()).toHaveTextContent('December')
    expect(yearTrigger()).toHaveTextContent('2029')
  })
})
