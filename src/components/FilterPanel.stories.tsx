import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { DatePicker } from '@/components/DatePicker'
import { FilterGroup } from '@/components/FilterGroup'
import { FilterPanel } from '@/components/FilterPanel'

const meta = {
  title: 'Components/FilterPanel',
} satisfies Meta

export default meta
type Story = StoryObj

export const WithFilters: Story = {
  name: 'FilterPanel · status + dates',
  parameters: {
    docs: {
      description: {
        story:
          'Frame for a page’s filters: active count, “Clear filters”, and a Show/Hide toggle that collapses the controls below `sm` (try a mobile viewport).',
      },
    },
  },
  render: function Render() {
    const [status, setStatus] = useState<string[]>(['all'])
    const [from, setFrom] = useState('')
    const active = (status.includes('all') ? 0 : 1) + (from ? 1 : 0)
    return (
      <div className="max-w-3xl">
        <FilterPanel
          activeCount={active}
          onClear={() => {
            setStatus(['all'])
            setFrom('')
          }}
        >
          <FilterGroup
            multiple
            label="Status"
            aria-label="Status"
            exclusiveValue="all"
            value={status}
            onChange={(next) => setStatus(next.length ? next : ['all'])}
            options={[
              { value: 'all', label: 'All' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
              { value: 'expired', label: 'Expired' },
            ]}
          />
          <div className="max-w-sm">
            <DatePicker
              label="From"
              placeholder="Any date"
              value={from}
              onChange={setFrom}
            />
          </div>
        </FilterPanel>
      </div>
    )
  },
}
