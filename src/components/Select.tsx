import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

import { cn } from '@/components/cn'

export type SelectOption = {
  value: string
  label: string
  disabled?: boolean
}

type SelectBaseProps = {
  id?: string
  label: string
  options: SelectOption[]
  placeholder?: string
  /** Keep a way to clear the selection (default true when placeholder is set). */
  clearable?: boolean
  /** Filter options by label while the menu is open (default true). */
  searchable?: boolean
  searchPlaceholder?: string
  error?: ReactNode
  hint?: ReactNode
  className?: string
  disabled?: boolean
}

export type SelectSingleProps = SelectBaseProps & {
  multiple?: false
  value: string
  onChange: (value: string) => void
}

export type SelectMultipleProps = SelectBaseProps & {
  multiple: true
  value: readonly string[]
  onChange: (value: string[]) => void
}

export type SelectProps = SelectSingleProps | SelectMultipleProps

function optionLabel(options: SelectOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value
}

function summarizeSelection(
  options: SelectOption[],
  values: readonly string[],
  placeholder: string,
): string {
  if (values.length === 0) return placeholder
  if (values.length === 1) return optionLabel(options, values[0])
  if (values.length === 2) {
    return `${optionLabel(options, values[0])}, ${optionLabel(options, values[1])}`
  }
  return `${values.length} selected`
}

export function Select(props: SelectProps) {
  const {
    id,
    label,
    options,
    placeholder = 'Select…',
    clearable = Boolean(props.placeholder),
    searchable = true,
    searchPlaceholder = 'Search…',
    error,
    hint,
    className,
    disabled = false,
  } = props

  const multiple = props.multiple === true
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const listboxId = `${fieldId}-listbox`
  const errorId = `${fieldId}-error`
  const hintId = `${fieldId}-hint`

  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const selectedValues = multiple ? props.value : props.value ? [props.value] : []

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return options
    return options.filter((option) => option.label.toLowerCase().includes(needle))
  }, [options, query])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }

    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!open || !searchable) return
    queueMicrotask(() => searchRef.current?.focus())
  }, [open, searchable])

  const openMenu = () => {
    setQuery('')
    setActiveIndex(0)
    setOpen(true)
  }

  const displayValue = summarizeSelection(options, selectedValues, placeholder)

  const selectValue = (next: string) => {
    const option = options.find((item) => item.value === next)
    if (!option || option.disabled) return

    if (multiple) {
      const exists = props.value.includes(next)
      props.onChange(exists ? props.value.filter((item) => item !== next) : [...props.value, next])
      return
    }

    props.onChange(next)
    setOpen(false)
    setQuery('')
  }

  const clearSelection = () => {
    if (multiple) props.onChange([])
    else props.onChange('')
  }

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openMenu()
    }
  }

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (filtered.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % filtered.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index - 1 + filtered.length) % filtered.length)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const option = filtered[activeIndex]
      if (option) selectValue(option.value)
    }
  }

  return (
    <div className={cn('space-y-2', className)} ref={rootRef}>
      <label htmlFor={fieldId} className="block text-sm font-medium text-mist">
        {label}
      </label>

      <div className="relative">
        <button
          id={fieldId}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          onClick={() => {
            if (disabled) return
            if (open) {
              setOpen(false)
              setQuery('')
              return
            }
            openMenu()
          }}
          onKeyDown={onTriggerKeyDown}
          className={cn(
            'w-full border border-line/20 bg-ink/40 py-3 pr-24 pl-4 text-left outline-none transition focus:border-ball/70 focus:ring-2 focus:ring-ball/30 disabled:opacity-60',
            error ? 'border-clay/50 focus:border-clay/70 focus:ring-clay/20' : null,
            selectedValues.length === 0 ? 'text-fog' : 'text-line',
          )}
        >
          <span className="block truncate">{displayValue}</span>
        </button>
        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-2">
          {clearable && selectedValues.length > 0 ? (
            <button
              type="button"
              aria-label="Clear selection"
              disabled={disabled}
              className="pointer-events-auto text-xs tracking-wide text-fog uppercase transition hover:text-ball disabled:opacity-60"
              onClick={(event) => {
                event.preventDefault()
                clearSelection()
              }}
            >
              Clear
            </button>
          ) : null}
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="h-4 w-4 shrink-0 text-fog"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </div>

        {open ? (
          <div
            className="absolute z-30 mt-1 w-full border border-line/20 bg-ink shadow-none"
            onKeyDown={onListKeyDown}
          >
            {searchable ? (
              <div className="border-b border-line/10 p-2">
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  placeholder={searchPlaceholder}
                  aria-label={`Search ${label}`}
                  className="w-full border border-line/20 bg-ink/40 px-3 py-2 text-sm text-line outline-none placeholder:text-fog focus:border-ball/70 focus:ring-2 focus:ring-ball/30"
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setActiveIndex(0)
                  }}
                />
              </div>
            ) : null}

            <ul
              id={listboxId}
              role="listbox"
              aria-multiselectable={multiple || undefined}
              aria-label={label}
              className="max-h-60 overflow-auto py-1"
            >
              {filtered.length === 0 ? (
                <li className="px-4 py-3 text-sm text-fog">No matches</li>
              ) : (
                filtered.map((option, index) => {
                  const selected = selectedValues.includes(option.value)
                  const active = index === activeIndex
                  return (
                    <li key={option.value} role="none">
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        disabled={option.disabled}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition disabled:opacity-40',
                          active ? 'bg-line/10 text-line' : 'text-mist hover:bg-line/5 hover:text-line',
                          selected && 'text-ball',
                        )}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => selectValue(option.value)}
                      >
                        {multiple ? (
                          <span
                            aria-hidden
                            className={cn(
                              'flex h-4 w-4 shrink-0 items-center justify-center border border-line/30',
                              selected && 'border-ball bg-ball text-ink',
                            )}
                          >
                            {selected ? '✓' : null}
                          </span>
                        ) : null}
                        <span className="min-w-0 flex-1 truncate">{option.label}</span>
                        {!multiple && selected ? (
                          <span aria-hidden className="text-ball">
                            ✓
                          </span>
                        ) : null}
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        ) : null}
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
