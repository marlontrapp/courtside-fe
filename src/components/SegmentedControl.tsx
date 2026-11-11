import { cn } from '@/components/cn'

export type SegmentOption<T extends string = string> = {
  value: T
  label: string
  disabled?: boolean
}

export type SegmentedControlProps<T extends string = string> = {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  'aria-label': string
  className?: string
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('inline-flex flex-wrap border border-line/20', className)}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'px-3 py-2 text-xs font-medium tracking-wide uppercase transition disabled:opacity-40',
              selected
                ? 'bg-ball/15 text-ball'
                : 'text-mist hover:bg-line/5 hover:text-line',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
