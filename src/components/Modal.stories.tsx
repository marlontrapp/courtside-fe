import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'

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
