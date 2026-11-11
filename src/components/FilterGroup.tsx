import { cn } from '@/components/cn'

export type FilterOption<T extends string = string> = {
  value: T
  label: string
  disabled?: boolean
}

type FilterGroupBase<T extends string> = {
  options: FilterOption<T>[]
  'aria-label': string
  /** Optional visible label above the control. */
  label?: string
  className?: string
  /**
   * When set in `multiple` mode, selecting this value clears every other
   * selection (e.g. an "All" chip). Selecting any other value removes it.
   */
  exclusiveValue?: T
}

export type FilterGroupSingleProps<T extends string = string> = FilterGroupBase<T> & {
  multiple?: false
  value: T
  onChange: (value: T) => void
}

export type FilterGroupMultipleProps<T extends string = string> = FilterGroupBase<T> & {
  multiple: true
  value: readonly T[]
  onChange: (value: T[]) => void
}

export type FilterGroupProps<T extends string = string> =
  | FilterGroupSingleProps<T>
  | FilterGroupMultipleProps<T>

function toggleMultiple<T extends string>(
  current: readonly T[],
  next: T,
  exclusiveValue?: T,
): T[] {
  if (exclusiveValue !== undefined && next === exclusiveValue) {
    return [exclusiveValue]
  }

  const withoutExclusive =
    exclusiveValue !== undefined ? current.filter((item) => item !== exclusiveValue) : [...current]

  if (withoutExclusive.includes(next)) {
    return withoutExclusive.filter((item) => item !== next)
  }

  return [...withoutExclusive, next]
}

export function FilterGroup<T extends string = string>(props: FilterGroupProps<T>) {
  const { options, label, className, exclusiveValue } = props
  const ariaLabel = props['aria-label']
  const multiple = props.multiple === true

  return (
    <div className={cn('space-y-2', className)}>
      {label ? <p className="text-sm font-medium text-mist">{label}</p> : null}
      <div
        role={multiple ? 'group' : 'radiogroup'}
        aria-label={ariaLabel}
        className="inline-flex flex-wrap border border-line/20"
      >
        {options.map((option) => {
          const selected = multiple
            ? props.value.includes(option.value)
            : props.value === option.value

          return (
            <button
              key={option.value}
              type="button"
              role={multiple ? 'checkbox' : 'radio'}
              aria-checked={selected}
              disabled={option.disabled}
              onClick={() => {
                if (multiple) {
                  props.onChange(toggleMultiple(props.value, option.value, exclusiveValue))
                  return
                }
                props.onChange(option.value)
              }}
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
    </div>
  )
}
