import { useId, type ReactNode } from 'react'

import { Calendar } from '@/components/Calendar'
import { cn } from '@/components/cn'
import { TextField } from '@/components/TextField'

export type DateFieldProps = {
  id?: string
  label: string
  value: string
  onChange: (isoDate: string) => void
  min?: string
  max?: string
  error?: ReactNode
  hint?: ReactNode
  showCalendar?: boolean
  className?: string
}

export function DateField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  error,
  hint,
  showCalendar = true,
  className,
}: DateFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <div className={cn('space-y-3', className)}>
      <TextField
        id={fieldId}
        label={label}
        type="date"
        value={value}
        min={min}
        max={max}
        error={error}
        hint={showCalendar ? undefined : hint}
        onChange={(event) => onChange(event.target.value)}
      />
      {showCalendar ? (
        <Calendar value={value || undefined} min={min} max={max} onChange={onChange} />
      ) : null}
      {showCalendar && hint && !error ? <p className="text-sm text-fog">{hint}</p> : null}
    </div>
  )
}
