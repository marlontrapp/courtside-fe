import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Select } from '@/components/Select'

const options = [
  {
    value: 'jardins',
    label: 'Jardins Country Club',
    description: 'Club admin · Groundskeeper',
  },
  { value: 'lisboa', label: 'Lisboa Tennis Club', description: 'Front desk' },
]

describe('Select additions', () => {
  it('shows option descriptions as a subtitle in the menu', async () => {
    const user = userEvent.setup()
    render(<Select label="Club" options={options} value="jardins" onChange={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Club' }))

    const jardins = within(screen.getByRole('listbox', { name: 'Club' })).getByRole(
      'option',
      {
        name: /Jardins Country Club/,
      },
    )
    expect(jardins).toHaveTextContent('Club admin · Groundskeeper')
    // The trigger shows the value only.
    expect(screen.getByRole('button', { name: 'Club' })).toHaveTextContent(
      'Jardins Country Club',
    )
  })

  it('plain variant: the value is the control, the label is for screen readers', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Select
        variant="plain"
        label="Club"
        options={options}
        value="jardins"
        onChange={onChange}
        clearable
      />,
    )

    expect(screen.getByText('Club', { selector: 'label' })).toHaveClass('sr-only')
    expect(
      screen.queryByRole('button', { name: 'Clear selection' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Club' }))
    await user.click(screen.getByRole('option', { name: /Lisboa/ }))
    expect(onChange).toHaveBeenCalledWith('lisboa')
  })

  it('hideLabel keeps the field style with an accessible label', () => {
    render(
      <Select
        hideLabel
        label="Slot 1 start"
        options={options}
        value=""
        onChange={() => {}}
      />,
    )

    expect(screen.getByText('Slot 1 start', { selector: 'label' })).toHaveClass('sr-only')
    expect(screen.getByRole('button', { name: 'Slot 1 start' })).toHaveClass('border')
  })
})
