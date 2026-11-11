import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/components/cn'

export type TimeSlotProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  meta?: string
  selected?: boolean
  unavailable?: boolean
}

export function TimeSlot({
  label,
  meta,
  selected = false,
  unavailable = false,
  className,
  disabled,
  type = 'button',
  ...props
}: TimeSlotProps) {
  const isDisabled = disabled || unavailable

  return (
    <button
      type={type}
      aria-pressed={selected}
      disabled={isDisabled}
      className={cn(
        'border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ball/30',
        unavailable
          ? 'cursor-not-allowed border-line/10 text-fog line-through opacity-50'
          : selected
            ? 'border-ball bg-ball/15 text-line'
            : 'border-line/20 text-mist hover:border-line/40 hover:text-line',
        className,
      )}
      {...props}
    >
      <span className="block text-sm font-medium tracking-wide">{label}</span>
      {meta ? <span className="mt-0.5 block text-xs text-fog">{meta}</span> : null}
    </button>
  )
}
