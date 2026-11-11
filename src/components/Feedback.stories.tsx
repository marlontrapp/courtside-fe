import type { Meta, StoryObj } from '@storybook/react-vite'

import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/Button'
import { Spinner } from '@/components/Spinner'
import { Divider } from '@/components/Divider'

const meta = {
  title: 'Components/Feedback',
} satisfies Meta

export default meta
type Story = StoryObj

export const Alerts: Story = {
  render: () => (
    <div className="space-y-3">
      <Alert tone="error">That slot was just taken. Pick another time.</Alert>
      <Alert tone="info">Members-only clubs appear after you sign in.</Alert>
      <Alert tone="success">Court booked for Saturday at 09:00.</Alert>
    </div>
  ),
}

export const Badges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>Open club</Badge>
      <Badge tone="accent">Confirmed</Badge>
      <Badge tone="warn">Pending</Badge>
      <Badge tone="muted">Inactive</Badge>
    </div>
  ),
}

export const Empty: Story = {
  render: () => (
    <EmptyState
      title="No courts match"
      description="Try another date or clear the surface filter."
      action={<Button variant="secondary">Clear filters</Button>}
    />
  ),
}

export const Loading: Story = {
  render: () => (
    <div className="space-y-4">
      <Spinner variant="court" label="Loading courts…" />
      <Spinner variant="ball" label="Finding a match…" />
      <Spinner variant="racket" label="Warming up…" />
    </div>
  ),
}

export const Dividers: Story = {
  render: () => (
    <div className="space-y-6">
      <Divider />
      <Divider label="Afternoon" />
    </div>
  ),
}
