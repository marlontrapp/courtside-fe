import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from '@/components/Button'

const meta = {
  title: 'Components/Button',
  component: Button,
  args: {
    children: 'Book court',
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = { args: { variant: 'primary' } }
export const Secondary: Story = { args: { variant: 'secondary' } }
export const Ghost: Story = { args: { variant: 'ghost' } }
export const Danger: Story = { args: { variant: 'danger', children: 'Cancel booking' } }
export const FullWidth: Story = { args: { fullWidth: true } }
export const Disabled: Story = { args: { disabled: true } }
