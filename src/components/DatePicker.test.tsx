import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DatePicker, type DatePickerProps } from '@/components/DatePicker'
import { freezeDate } from '@/test/render'

/** Controlled wrapper, like a real form. */
function Harness(props: Partial<DatePickerProps> & { initial?: string }) {
  const { initial = '', onChange, ...rest } = props
  const [value, setValue] = useState(initial)
  return (
    <>
      <DatePicker
        label="Play date"
        placeholder="Today"
        {...rest}
        value={value}
        onChange={(next) => {
          setValue(next)
          onChange?.(next)
        }}
      />
      <button type="button">Elsewhere</button>
    </>
  )
}

const trigger = () => screen.getByRole('button', { name: 'Play date' })
const calendar = () => screen.queryByRole('dialog', { name: 'Play date' })

describe('DatePicker', () => {
  beforeEach(() => freezeDate('2030-01-08T12:00:00-03:00'))

  it('shows the placeholder, then the picked day', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    expect(trigger()).toHaveTextContent('Today')
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
    expect(calendar()).not.toBeInTheDocument()

    await user.click(trigger())
    expect(trigger()).toHaveAttribute('aria-expanded', 'true')
    await user.click(within(calendar()!).getByRole('button', { name: '2030-01-10' }))

    expect(onChange).toHaveBeenCalledWith('2030-01-10')
    expect(trigger()).toHaveTextContent('Thu, Jan 10, 2030')
    expect(calendar()).not.toBeInTheDocument()
    expect(trigger()).toHaveFocus()
  })

  it('focuses the selected day when opening, else today', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Harness initial="2030-01-20" />)

    await user.click(trigger())
    expect(within(calendar()!).getByRole('button', { name: '2030-01-20' })).toHaveFocus()
    unmount()

    render(<Harness />)
    await user.click(trigger())
    expect(within(calendar()!).getByRole('button', { name: '2030-01-08' })).toHaveFocus()
  })

  it('closes with Escape (focus back on the field) and on outside clicks', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(trigger())
    await user.keyboard('{Escape}')
    expect(calendar()).not.toBeInTheDocument()
    expect(trigger()).toHaveFocus()

    await user.click(trigger())
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }))
    expect(calendar()).not.toBeInTheDocument()
  })

  it('closes the month menu before the picker itself', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(trigger())

    await user.click(within(calendar()!).getByRole('button', { name: /^Month:/ }))
    expect(screen.getByRole('listbox', { name: 'Month' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox', { name: 'Month' })).not.toBeInTheDocument()
    expect(calendar()).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(calendar()).not.toBeInTheDocument()
    expect(trigger()).toHaveFocus()
  })

  it('opens with ArrowDown from the keyboard', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    trigger().focus()
    await user.keyboard('{ArrowDown}')

    expect(calendar()).toBeInTheDocument()
  })

  it('lets the user browse months without closing', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(trigger())
    await user.click(within(calendar()!).getByRole('button', { name: 'Next month' }))

    expect(
      within(calendar()!).getByRole('button', { name: 'Month: February' }),
    ).toBeInTheDocument()
    expect(
      within(calendar()!).getByRole('button', { name: 'Year: 2030' }),
    ).toBeInTheDocument()
  })

  it('only allows days between min and max', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness min="2030-01-09" max="2030-01-15" onChange={onChange} />)

    await user.click(trigger())
    const days = within(calendar()!)
    // Focus lands on the first pickable day when today isn't allowed.
    expect(days.getByRole('button', { name: '2030-01-09' })).toHaveFocus()
    expect(days.getByRole('button', { name: '2030-01-08' })).toBeDisabled()
    expect(days.getByRole('button', { name: '2030-01-09' })).toBeEnabled()
    expect(days.getByRole('button', { name: '2030-01-15' })).toBeEnabled()
    expect(days.getByRole('button', { name: '2030-01-16' })).toBeDisabled()

    await user.click(days.getByRole('button', { name: '2030-01-16' }))
    expect(onChange).not.toHaveBeenCalled()
    expect(calendar()).toBeInTheDocument()
  })

  it('opens on the month of `min` when empty', async () => {
    const user = userEvent.setup()
    render(<Harness min="2030-03-02" />)

    await user.click(trigger())

    expect(
      within(calendar()!).getByRole('button', { name: 'Month: March' }),
    ).toBeInTheDocument()
  })

  it('clears the value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness initial="2030-01-10" onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Clear Play date' }))

    expect(onChange).toHaveBeenCalledWith('')
    expect(trigger()).toHaveTextContent('Today')
    expect(
      screen.queryByRole('button', { name: 'Clear Play date' }),
    ).not.toBeInTheDocument()
  })

  it('can hide the clear action', () => {
    render(<Harness initial="2030-01-10" clearable={false} />)

    expect(
      screen.queryByRole('button', { name: 'Clear Play date' }),
    ).not.toBeInTheDocument()
  })

  it('links the error (or hint) to the field', () => {
    const { rerender } = render(
      <DatePicker label="Play date" value="" onChange={() => {}} hint="Optional" />,
    )
    expect(trigger()).toHaveAccessibleDescription('Optional')
    expect(trigger()).not.toHaveAttribute('aria-invalid')

    rerender(
      <DatePicker
        label="Play date"
        value=""
        onChange={() => {}}
        hint="Optional"
        error="Pick today or a later date."
      />,
    )
    expect(trigger()).toHaveAttribute('aria-invalid', 'true')
    expect(trigger()).toHaveAccessibleDescription('Pick today or a later date.')
  })

  it('does not open when disabled', async () => {
    const user = userEvent.setup()
    render(<Harness disabled />)

    await user.click(trigger())

    expect(calendar()).not.toBeInTheDocument()
  })
})
