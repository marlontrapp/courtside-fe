import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

import { cn } from '@/components/cn'

/**
 * Interaction container only — do not wrap static marketing copy.
 * Prefer plain layout until a hit-target / selectable surface is needed.
 */
export type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  selected?: boolean
}

export function Card({ selected = false, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'border border-line/20 bg-ink/30 p-4 transition',
        selected && 'border-ball bg-ball/10',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export type SelectableCardProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean
  children: ReactNode
}

export function SelectableCard({
  selected = false,
  className,
  children,
  type = 'button',
  ...props
}: SelectableCardProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'w-full border border-line/20 bg-ink/30 p-4 text-left transition hover:border-line/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ball/30',
        selected && 'border-ball bg-ball/10',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
