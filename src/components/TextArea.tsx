import { useId, type ReactNode, type TextareaHTMLAttributes } from 'react'

import { cn } from '@/components/cn'

export type TextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & {
  id?: string
  label: string
  error?: ReactNode
  hint?: ReactNode
}

export function TextArea({
  id,
  label,
  error,
  hint,
  className,
  rows = 4,
  ...props
}: TextAreaProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const errorId = `${fieldId}-error`
  const hintId = `${fieldId}-hint`

  return (
    <div className="space-y-2">
      <label htmlFor={fieldId} className="block text-sm font-medium text-mist">
        {label}
      </label>
      <textarea
        id={fieldId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={cn(
          'w-full resize-y border border-line/20 bg-ink/40 px-4 py-3 text-line outline-none transition placeholder:text-fog focus:border-ball/70 focus:ring-2 focus:ring-ball/30',
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
