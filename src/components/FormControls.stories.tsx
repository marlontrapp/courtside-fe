import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { Checkbox } from '@/components/Checkbox'
import { Select } from '@/components/Select'
import { TextArea } from '@/components/TextArea'

const surfaceOptions = [
  { value: 'clay', label: 'Clay' },
  { value: 'hard', label: 'Hard' },
  { value: 'grass', label: 'Grass' },
  { value: 'carpet', label: 'Carpet' },
  { value: 'synthetic', label: 'Synthetic' },
]

const meta = {
  title: 'Components/FormControls',
} satisfies Meta

export default meta
type Story = StoryObj

export const SelectSingleSearchable: Story = {
  name: 'Select · single + search',
  render: function Render() {
    const [value, setValue] = useState('')
    return (
      <div className="space-y-3">
        <Select
          label="Surface"
          placeholder="Any surface"
          value={value}
          onChange={setValue}
          options={surfaceOptions}
        />
        <p className="text-sm text-fog">Value: {value || '(none)'}</p>
      </div>
    )
  },
}

export const SelectMultipleSearchable: Story = {
  name: 'Select · multiple + search',
  render: function Render() {
    const [value, setValue] = useState<string[]>(['clay'])
    return (
      <div className="space-y-3">
        <Select
          multiple
          label="Surfaces"
          placeholder="Choose surfaces"
          value={value}
          onChange={setValue}
          options={surfaceOptions}
          hint="Local search — filters the options array in the browser."
        />
        <p className="text-sm text-fog">Value: {value.join(', ') || '(none)'}</p>
      </div>
    )
  },
}

export const SelectAsyncSearch: Story = {
  name: 'Select · async / backend search',
  render: function Render() {
    const catalog = [
      { value: 'ibirapuera', label: 'Ibirapuera Tennis Center' },
      { value: 'jardins', label: 'Jardins Country Club' },
      { value: 'morumbi', label: 'Morumbi Racquet Club' },
      { value: 'lisboa', label: 'Lisboa Tennis Club' },
      { value: 'old-town', label: 'Old Town Courts' },
    ]
    const [value, setValue] = useState('')
    const [options, setOptions] = useState(catalog)
    const [loading, setLoading] = useState(false)

    return (
      <div className="space-y-3">
        <Select
          label="Club"
          placeholder="Search clubs"
          value={value}
          onChange={setValue}
          options={options}
          loading={loading}
          searchDebounceMs={250}
          hint="Simulates a backend search via onSearchChange (filterLocally off)."
          onSearchChange={(query) => {
            setLoading(true)
            window.setTimeout(() => {
              const needle = query.trim().toLowerCase()
              setOptions(
                needle
                  ? catalog.filter((option) => option.label.toLowerCase().includes(needle))
                  : catalog,
              )
              setLoading(false)
            }, 350)
          }}
        />
        <p className="text-sm text-fog">Value: {value || '(none)'}</p>
      </div>
    )
  },
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
