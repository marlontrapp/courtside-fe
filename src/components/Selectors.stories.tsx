import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { FilterGroup } from '@/components/FilterGroup'
import { TimeSlot } from '@/components/TimeSlot'

const meta = {
  title: 'Components/Selectors',
} satisfies Meta

export default meta
type Story = StoryObj

export const SingleFilter: Story = {
  name: 'Filter · single',
  render: function Render() {
    const [value, setValue] = useState('all')
    return (
      <FilterGroup
        label="Surface"
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

export const MultiFilter: Story = {
  name: 'Filter · multiple',
  render: function Render() {
    const [value, setValue] = useState<string[]>(['clay', 'hard'])
    return (
      <div className="space-y-3">
        <FilterGroup
          multiple
          label="Surfaces"
          aria-label="Surfaces"
          exclusiveValue="all"
          value={value}
          onChange={setValue}
          options={[
            { value: 'all', label: 'All' },
            { value: 'clay', label: 'Clay' },
            { value: 'hard', label: 'Hard' },
            { value: 'grass', label: 'Grass' },
          ]}
        />
        <p className="text-sm text-fog">Selected: {value.join(', ') || 'none'}</p>
      </div>
    )
  },
}

export const MultiFilterAmenities: Story = {
  name: 'Filter · amenities',
  render: function Render() {
    const [value, setValue] = useState<string[]>(['lighting'])
    return (
      <FilterGroup
        multiple
        label="Amenities"
        aria-label="Amenities"
        value={value}
        onChange={setValue}
        options={[
          { value: 'lighting', label: 'Lighting' },
          { value: 'indoor', label: 'Indoor' },
          { value: 'covered', label: 'Covered' },
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
