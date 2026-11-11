import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/components/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'md' | 'sm'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

const variantClass: Record<ButtonVariant, string> = {
  primary:
    'bg-ball text-ink hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60',
  secondary:
    'border border-line/30 text-line hover:border-ball hover:text-ball disabled:opacity-60',
  ghost:
    'border border-line/20 text-mist hover:border-ball hover:text-ball disabled:opacity-60',
  danger:
    'border border-clay/50 text-mist hover:border-clay hover:text-line disabled:opacity-60',
}

const sizeClass: Record<ButtonSize, string> = {
  md: 'px-4 py-2.5 text-sm',
  sm: 'px-3 py-2 text-xs',
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center font-medium tracking-wide uppercase transition',
        variant === 'primary' && 'font-semibold',
        sizeClass[size],
        variantClass[variant],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
