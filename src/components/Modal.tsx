import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

import { Button } from '@/components/Button'
import { cn } from '@/components/cn'

export type ModalProps = {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
  className?: string
  /**
   * Below the `sm` breakpoint, cover the whole screen instead of floating as a
   * bottom sheet — for forms that need the room on phones.
   */
  fullScreenOnMobile?: boolean
  /** Element to focus when the dialog opens (default: first focusable in the body). */
  initialFocusRef?: RefObject<HTMLElement | null>
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusableIn(root: HTMLElement | null): HTMLElement[] {
  return root ? [...root.querySelectorAll<HTMLElement>(FOCUSABLE)] : []
}

export function Modal({
  open,
  title,
  children,
  onClose,
  footer,
  className,
  fullScreenOnMobile = false,
  initialFocusRef,
}: ModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  // Latest onClose without re-running the open/close effects on every render.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Escape closes; Tab stays inside the dialog.
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = focusableIn(dialogRef.current)
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  // Move focus in on open, give it back to the trigger on close; lock page scroll.
  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    const target =
      initialFocusRef?.current ?? focusableIn(bodyRef.current)[0] ?? dialogRef.current
    target?.focus()

    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = overflow
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [open, initialFocusRef])

  if (!open) return null

  // Portal to <body>: a transformed ancestor (e.g. the `fade-up` animation)
  // would otherwise become the containing block of `position: fixed`, and the
  // dialog would no longer cover the viewport.
  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-end justify-center sm:items-center',
        fullScreenOnMobile ? 'sm:p-4' : 'p-4',
      )}
    >
      <button
        type="button"
        aria-label="Dismiss dialog"
        tabIndex={-1}
        className="absolute inset-0 bg-ink/75"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative z-10 flex w-full flex-col bg-ink p-5 shadow-none outline-none sm:p-6',
          fullScreenOnMobile
            ? 'h-dvh sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-lg sm:border sm:border-line/20'
            : 'max-h-[calc(100dvh-2rem)] max-w-lg border border-line/20',
          className,
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-4">
          <h2 id={titleId} className="font-display text-2xl tracking-tight text-line">
            {title}
          </h2>
          <Button variant="ghost" size="sm" aria-label="Close dialog" onClick={onClose}>
            Close
          </Button>
        </div>
        {/* Scrolls when the content is taller than the dialog (always, full-screen). */}
        <div
          ref={bodyRef}
          className="-mx-1 mt-4 min-h-0 flex-1 overflow-y-auto px-1 text-sm leading-relaxed text-mist"
        >
          {children}
        </div>
        {footer ? (
          <div className="mt-6 flex shrink-0 flex-wrap justify-end gap-3">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
