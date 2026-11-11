import { useId, type InputHTMLAttributes, type ReactNode } from 'react'

import { cn } from '@/components/cn'

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  id?: string
  label: string
  error?: ReactNode
  hint?: ReactNode
}

export function TextField({
  id,
  label,
  error,
  hint,
  className,
  ...props
}: TextFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const errorId = `${fieldId}-error`
  const hintId = `${fieldId}-hint`

  return (
    <div className="space-y-2">
      <label htmlFor={fieldId} className="block text-sm font-medium text-mist">
        {label}
      </label>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={cn(
          'w-full border border-line/20 bg-ink/40 px-4 py-3 text-line outline-none transition placeholder:text-fog focus:border-ball/70 focus:ring-2 focus:ring-ball/30',
          error ? 'border-clay/50 focus:border-clay/70 focus:ring-clay/20' : null,
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-sm text-clay">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm text-fog">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
