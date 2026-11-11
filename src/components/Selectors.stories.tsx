import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { SegmentedControl } from '@/components/SegmentedControl'
import { TimeSlot } from '@/components/TimeSlot'

const meta = {
  title: 'Components/Selectors',
} satisfies Meta

export default meta
type Story = StoryObj

export const SurfaceFilter: Story = {
  render: function Render() {
    const [value, setValue] = useState('all')
    return (
      <SegmentedControl
        aria-label="Surface"
        value={value}
        onChange={setValue}
        options={[
          { value: 'all', label: 'All' },
          { value: 'clay', label: 'Clay' },
          { value: 'hard', label: 'Hard' },
          { value: 'grass', label: 'Grass' },
        ]}
      />
    )
  },
}

export const TimeSlots: Story = {
  render: function Render() {
    const [selected, setSelected] = useState('09:00')
    return (
      <div className="grid max-w-md grid-cols-2 gap-2 sm:grid-cols-3">
        <TimeSlot
          label="09:00"
          meta="60 min"
          selected={selected === '09:00'}
          onClick={() => setSelected('09:00')}
        />
        <TimeSlot
          label="10:00"
          meta="60 min"
          selected={selected === '10:00'}
          onClick={() => setSelected('10:00')}
        />
        <TimeSlot label="11:00" meta="Taken" unavailable />
        <TimeSlot
          label="12:00"
          meta="90 min"
          selected={selected === '12:00'}
          onClick={() => setSelected('12:00')}
        />
      </div>
    )
  },
}
