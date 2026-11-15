import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from '@/components/Button'
import { Checkbox } from '@/components/Checkbox'
import { Modal } from '@/components/Modal'
import { TextArea } from '@/components/TextArea'
import { TextField } from '@/components/TextField'

const meta = {
  title: 'Components/Modal',
} satisfies Meta

export default meta
type Story = StoryObj

export const ConfirmCancel: Story = {
  render: function Render() {
    const [open, setOpen] = useState(true)
    return (
      <>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Open modal
        </Button>
        <Modal
          open={open}
          title="Cancel booking?"
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Keep it
              </Button>
              <Button variant="danger" onClick={() => setOpen(false)}>
                Cancel booking
              </Button>
            </>
          }
        >
          Cancellations inside the club window may be blocked by policy.
        </Modal>
      </>
    )
  },
}

export const FullScreenOnMobile: Story = {
  name: 'Full screen on mobile (form)',
  parameters: {
    docs: {
      description: {
        story:
          'With `fullScreenOnMobile`, the dialog covers the viewport below the `sm` breakpoint (try a mobile viewport); the body scrolls while the title and actions stay put.',
      },
    },
  },
  render: function Render() {
    const [open, setOpen] = useState(true)
    return (
      <>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Open booking form
        </Button>
        <Modal
          open={open}
          fullScreenOnMobile
          title="Book Court 1 - Guga"
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setOpen(false)}>Book court</Button>
            </>
          }
        >
          <div className="space-y-5">
            <Checkbox label="Include lighting (+30.00 / hour)" />
            <TextField
              label="Guest 1 email"
              type="email"
              placeholder="friend@club.example"
            />
            <TextArea label="Notes (optional)" rows={6} />
          </div>
        </Modal>
      </>
    )
  },
}
