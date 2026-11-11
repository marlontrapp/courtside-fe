import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { Card, SelectableCard } from '@/components/Card'
import { Badge } from '@/components/Badge'

const meta = {
  title: 'Components/Card',
} satisfies Meta

export default meta
type Story = StoryObj

export const Static: Story = {
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
  render: function Render() {
    const [selected, setSelected] = useState('a')
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {(['a', 'b'] as const).map((id) => (
          <SelectableCard
            key={id}
            selected={selected === id}
            onClick={() => setSelected(id)}
          >
            <p className="text-sm font-medium tracking-wide text-line uppercase">
              Court {id.toUpperCase()}
            </p>
            <p className="mt-1 text-sm text-mist">Tap to select</p>
          </SelectableCard>
        ))}
      </div>
    )
  },
}
