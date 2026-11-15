import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { Modal, type ModalProps } from '@/components/Modal'

function Harness(props: Partial<ModalProps> & { withInitialFocus?: boolean }) {
  const { withInitialFocus, ...rest } = props
  const [open, setOpen] = useState(false)
  const notesRef = useRef<HTMLTextAreaElement>(null)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Modal
        title="Book court"
        {...rest}
        open={open}
        onClose={() => {
          rest.onClose?.()
          setOpen(false)
        }}
        initialFocusRef={withInitialFocus ? notesRef : undefined}
        footer={<button type="button">Confirm</button>}
      >
        <input aria-label="Email" />
        <textarea aria-label="Notes" ref={notesRef} />
      </Modal>
    </>
  )
}

const dialog = () => screen.queryByRole('dialog', { name: 'Book court' })

describe('Modal', () => {
  it('renders nothing while closed', () => {
    render(
      <Modal open={false} title="Hidden" onClose={() => {}}>
        Body
      </Modal>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('is a modal dialog named by its title', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))

    expect(dialog()).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('heading', { name: 'Book court' })).toBeInTheDocument()
  })

  it.each([
    [
      'Escape',
      async (user: ReturnType<typeof userEvent.setup>) => user.keyboard('{Escape}'),
    ],
    [
      'the Close button',
      async (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByRole('button', { name: 'Close dialog' })),
    ],
    [
      'the backdrop',
      async (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByRole('button', { name: 'Dismiss dialog' })),
    ],
  ])('closes with %s', async (_how, act) => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Open' }))

    await act(user)

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(dialog()).not.toBeInTheDocument()
  })

  it('moves focus into the body, and back to the trigger on close', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open' })

    await user.click(trigger)
    expect(screen.getByLabelText('Email')).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
  })

  it('focuses initialFocusRef when given', async () => {
    const user = userEvent.setup()
    render(<Harness withInitialFocus />)

    await user.click(screen.getByRole('button', { name: 'Open' }))

    expect(screen.getByLabelText('Notes')).toHaveFocus()
  })

  it('keeps Tab inside the dialog', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))

    // Email → Notes → Confirm → (wraps) Close → Email
    await user.tab()
    expect(screen.getByLabelText('Notes')).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus()
    // The backdrop is mouse-only.
    expect(screen.getByRole('button', { name: 'Dismiss dialog' })).toHaveAttribute(
      'tabindex',
      '-1',
    )
  })

  it('locks page scroll while open', async () => {
    const user = userEvent.setup()
    document.body.style.overflow = 'auto'
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(document.body.style.overflow).toBe('hidden')

    await user.keyboard('{Escape}')
    expect(document.body.style.overflow).toBe('auto')
  })

  it('can cover the whole screen on small viewports', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    // Default: floating sheet with a border at every size.
    expect(dialog()).toHaveClass('max-w-lg', 'border')
    expect(dialog()).not.toHaveClass('h-dvh')
    unmount()

    render(<Harness fullScreenOnMobile />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    // Full viewport height below `sm`; a bordered max-w-lg dialog from `sm` up.
    expect(dialog()).toHaveClass('h-dvh', 'sm:h-auto', 'sm:max-w-lg', 'sm:border')
    expect(dialog()).not.toHaveClass('max-w-lg')
    expect(dialog()!.parentElement).not.toHaveClass('p-4')
  })

  it('renders into <body>, so transformed ancestors cannot trap the fixed overlay', () => {
    render(
      // e.g. the `fade-up` entrance animation leaves a transform on page sections
      <div data-testid="animated-host" style={{ transform: 'translateY(0)' }}>
        <Modal open title="Portaled" onClose={() => {}}>
          Body
        </Modal>
      </div>,
    )

    const dialog = screen.getByRole('dialog', { name: 'Portaled' })
    expect(screen.getByTestId('animated-host')).not.toContainElement(dialog)
    expect(dialog.parentElement?.parentElement).toBe(document.body)
  })
})
