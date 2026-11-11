import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from '@/components/Button'
import { PageHeader } from '@/components/PageHeader'

const meta = {
  title: 'Components/PageHeader',
  component: PageHeader,
} satisfies Meta<typeof PageHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    eyebrow: 'Courts',
    title: 'Find a court',
    description: 'Pick a date, then book an open slot.',
  },
}

export const WithActions: Story = {
  args: {
    eyebrow: 'Bookings',
    title: 'My bookings',
    description: 'Confirmed and pending reservations.',
    actions: <Button variant="secondary">Refresh</Button>,
  },
}
