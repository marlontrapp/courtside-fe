import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { Checkbox } from '@/components/Checkbox'
import { Select } from '@/components/Select'
import { TextArea } from '@/components/TextArea'

const meta = {
  title: 'Components/FormControls',
} satisfies Meta

export default meta
type Story = StoryObj

export const SelectDefault: Story = {
  render: () => (
    <Select
      label="Surface"
      placeholder="Any surface"
      defaultValue=""
      options={[
        { value: 'clay', label: 'Clay' },
        { value: 'hard', label: 'Hard' },
        { value: 'grass', label: 'Grass' },
      ]}
    />
  ),
}

export const TextAreaDefault: Story = {
  render: () => (
    <TextArea label="Notes" placeholder="Guest names, lesson details…" hint="Optional" />
  ),
}

export const CheckboxDefault: Story = {
  render: function Render() {
    const [checked, setChecked] = useState(false)
    return (
      <Checkbox
        label="Bring a non-member guest"
        checked={checked}
        onChange={(event) => setChecked(event.target.checked)}
      />
    )
  },
}
