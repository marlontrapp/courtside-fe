import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '@/components/cn'

export type BadgeTone = 'neutral' | 'accent' | 'warn' | 'muted'

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone
  children: ReactNode
}

const toneClass: Record<BadgeTone, string> = {
  neutral: 'border-line/25 text-mist',
  accent: 'border-ball/50 text-ball',
  warn: 'border-clay/50 text-clay',
  muted: 'border-line/15 text-fog',
}

export function Badge({ tone = 'neutral', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center border px-2 py-0.5 text-xs font-medium tracking-wide uppercase',
        toneClass[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
