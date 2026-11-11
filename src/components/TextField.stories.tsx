import type { Meta, StoryObj } from '@storybook/react-vite'

import { TextField } from '@/components/TextField'

const meta = {
  title: 'Components/TextField',
  component: TextField,
  args: {
    label: 'Email',
    placeholder: 'you@club.example',
  },
} satisfies Meta<typeof TextField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const WithHint: Story = { args: { hint: 'Use the email on your membership.' } }
export const WithError: Story = { args: { error: 'Enter a valid email' } }
export const Password: Story = {
  args: { label: 'Password', type: 'password', placeholder: '••••••••' },
}
