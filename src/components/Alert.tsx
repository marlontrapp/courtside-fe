import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '@/components/cn'

export type AlertTone = 'error' | 'info' | 'success'

export type AlertProps = HTMLAttributes<HTMLParagraphElement> & {
  tone?: AlertTone
  children: ReactNode
}

const toneClass: Record<AlertTone, string> = {
  error: 'border-clay/40 bg-clay/10 text-mist',
  info: 'border-line/20 bg-line/5 text-mist',
  success: 'border-ball/40 bg-ball/10 text-line',
}

export function Alert({ tone = 'error', className, children, ...props }: AlertProps) {
  return (
    <p
      role="alert"
      className={cn('border px-3 py-2 text-sm', toneClass[tone], className)}
      {...props}
    >
      {children}
    </p>
  )
}
