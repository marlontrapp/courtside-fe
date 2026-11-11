import { useId, type InputHTMLAttributes, type ReactNode } from 'react'

import { cn } from '@/components/cn'

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> & {
  id?: string
  label: ReactNode
  error?: ReactNode
}

export function Checkbox({ id, label, error, className, ...props }: CheckboxProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const errorId = `${fieldId}-error`

  return (
    <div className="space-y-2">
      <label htmlFor={fieldId} className="flex cursor-pointer items-start gap-3 text-sm text-mist">
        <input
          id={fieldId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0 appearance-none border border-line/30 bg-ink/40 outline-none transition checked:border-ball checked:bg-ball focus-visible:ring-2 focus-visible:ring-ball/30',
            className,
          )}
          {...props}
        />
        <span>{label}</span>
      </label>
      {error ? (
        <p id={errorId} className="text-sm text-clay">
          {error}
        </p>
      ) : null}
    </div>
  )
}
