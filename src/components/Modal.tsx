import { useEffect, type ReactNode } from 'react'

import { Button } from '@/components/Button'
import { cn } from '@/components/cn'

export type ModalProps = {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
  className?: string
}

export function Modal({ open, title, children, onClose, footer, className }: ModalProps) {
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Dismiss dialog"
        className="absolute inset-0 bg-ink/75"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative z-10 w-full max-w-lg border border-line/20 bg-ink p-5 shadow-none sm:p-6',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-2xl tracking-tight text-line">{title}</h2>
          <Button variant="ghost" size="sm" aria-label="Close dialog" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="mt-4 text-sm leading-relaxed text-mist">{children}</div>
        {footer ? <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div> : null}
      </div>
    </div>
  )
}
