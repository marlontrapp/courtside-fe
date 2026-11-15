import { PLAYER_BOOKING_TYPES, type BookingType } from '@/api/reservations'
import { Alert } from '@/components/Alert'
import { DatePicker } from '@/components/DatePicker'
import { FilterGroup, type FilterOption } from '@/components/FilterGroup'
import { FilterPanel } from '@/components/FilterPanel'
import { BOOKING_TYPE_LABELS } from '@/pages/courts/booking'
import {
  HISTORY_STATES,
  activeHistoryFilterCount,
  hasHistoryErrors,
  type HistoryFilterErrors,
  type HistoryFilters,
  type HistoryRole,
  type HistoryState,
} from '@/pages/history/historyFilters'

/** Chip meaning "no filter" in the multi-select groups; never sent to the API. */
const ALL = 'ALL'

const STATE_LABELS: Record<HistoryState, string> = {
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired',
}

const STATE_OPTIONS: FilterOption<HistoryState | typeof ALL>[] = [
  { value: ALL, label: 'All' },
  ...HISTORY_STATES.map((value) => ({ value, label: STATE_LABELS[value] })),
]

const ROLE_OPTIONS: FilterOption<HistoryRole>[] = [
  { value: 'all', label: 'All' },
  { value: 'owner', label: 'Booked by me' },
  { value: 'guest', label: 'As a guest' },
]

const TYPE_OPTIONS: FilterOption<BookingType | typeof ALL>[] = [
  { value: ALL, label: 'All' },
  ...PLAYER_BOOKING_TYPES.map((value) => ({ value, label: BOOKING_TYPE_LABELS[value] })),
]

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-clay">{message}</p> : null
}

export type HistoryFiltersPanelProps = {
  filters: HistoryFilters
  errors: HistoryFilterErrors
  onChange: (next: HistoryFilters) => void
  onClear: () => void
}

export function HistoryFiltersPanel({
  filters,
  errors,
  onChange,
  onClear,
}: HistoryFiltersPanelProps) {
  const update = (patch: Partial<HistoryFilters>) => onChange({ ...filters, ...patch })
  const withoutAll = <T extends string>(values: (T | typeof ALL)[]) =>
    values.filter((value): value is T => value !== ALL)

  return (
    <FilterPanel
      activeCount={activeHistoryFilterCount(filters)}
      onClear={onClear}
      forceOpen={hasHistoryErrors(errors)}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <FilterGroup
            multiple
            label="Status"
            aria-label="Status"
            exclusiveValue={ALL}
            options={STATE_OPTIONS}
            value={filters.states.length ? filters.states : [ALL]}
            onChange={(next) => update({ states: withoutAll(next) })}
          />
          <FieldError message={errors.states} />
        </div>
        <div className="space-y-2">
          <FilterGroup
            label="Role"
            aria-label="Role"
            options={ROLE_OPTIONS}
            value={filters.role}
            onChange={(role) => update({ role })}
          />
          <FieldError message={errors.role} />
        </div>
      </div>

      <div className="space-y-2">
        <FilterGroup
          multiple
          label="Booking type"
          aria-label="Booking type"
          exclusiveValue={ALL}
          options={TYPE_OPTIONS}
          value={filters.types.length ? filters.types : [ALL]}
          onChange={(next) => update({ types: withoutAll(next) })}
        />
        <FieldError message={errors.types} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <DatePicker
          label="From"
          placeholder="Any date"
          value={filters.dateFrom}
          max={filters.dateTo || undefined}
          defaultMonth={filters.dateTo || undefined}
          onChange={(dateFrom) => update({ dateFrom })}
          error={errors.dateFrom}
        />
        <DatePicker
          label="To"
          placeholder="Any date"
          value={filters.dateTo}
          min={filters.dateFrom || undefined}
          onChange={(dateTo) => update({ dateTo })}
          error={errors.dateTo}
          hint="Booking dates, in each club's local time."
        />
      </div>

      {errors.general ? <Alert>{errors.general}</Alert> : null}
    </FilterPanel>
  )
}
