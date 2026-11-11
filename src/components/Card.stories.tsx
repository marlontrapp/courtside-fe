import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { Badge } from '@/components/Badge'
import { Card, SelectableCard } from '@/components/Card'

const meta = {
  title: 'Components/Card',
} satisfies Meta

export default meta
type Story = StoryObj

export const Static: Story = {
  name: 'Card · static (not clickable)',
  render: () => (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium tracking-wide text-line uppercase">Court 3</p>
          <p className="mt-1 text-sm text-mist">Clay · outdoor · lighting</p>
        </div>
        <Badge tone="accent">Open</Badge>
      </div>
    </Card>
  ),
}

export const Selectable: Story = {
  name: 'Card · selectable',
  render: function Render() {
    const [selected, setSelected] = useState<string | null>('a')
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {(['a', 'b'] as const).map((id) => {
            const isSelected = selected === id
            return (
              <SelectableCard
                key={id}
                selected={isSelected}
                onClick={() => setSelected((current) => (current === id ? null : id))}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium tracking-wide text-line uppercase">
                      Court {id.toUpperCase()}
                    </p>
                    <p className="mt-1 text-sm text-mist">Tap to select / tap again to clear</p>
                  </div>
                  {isSelected ? <Badge tone="accent">Selected</Badge> : null}
                </div>
              </SelectableCard>
            )
          })}
        </div>
        <p className="text-sm text-fog">Selected: {selected ?? '(none)'}</p>
      </div>
    )
  },
}
