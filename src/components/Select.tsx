import { useId, type ReactNode, type SelectHTMLAttributes } from 'react'

import { cn } from '@/components/cn'

export type SelectOption = {
  value: string
  label: string
  disabled?: boolean
}

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
  id?: string
  label: string
  options: SelectOption[]
  placeholder?: string
  error?: ReactNode
  hint?: ReactNode
}

export function Select({
  id,
  label,
  options,
  placeholder,
  error,
  hint,
  className,
  ...props
}: SelectProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const errorId = `${fieldId}-error`
  const hintId = `${fieldId}-hint`

  return (
    <div className="space-y-2">
      <label htmlFor={fieldId} className="block text-sm font-medium text-mist">
        {label}
      </label>
      <div className="relative">
        <select
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={cn(
            'w-full appearance-none border border-line/20 bg-ink/40 px-4 py-3 pr-10 text-line outline-none transition focus:border-ball/70 focus:ring-2 focus:ring-ball/30',
            'scheme-dark [&>option]:bg-ink [&>option]:text-line',
            error ? 'border-clay/50 focus:border-clay/70 focus:ring-clay/20' : null,
            className,
          )}
          {...props}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-fog"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </span>
      </div>
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
