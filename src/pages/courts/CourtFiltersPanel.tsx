import { Alert } from '@/components/Alert'
import { DatePicker } from '@/components/DatePicker'
import { FilterGroup, type FilterOption } from '@/components/FilterGroup'
import { FilterPanel } from '@/components/FilterPanel'
import { Select, type SelectOption } from '@/components/Select'
import {
  END_TIMES,
  MAX_WINDOW_DAYS,
  START_TIMES,
  activeFilterCount,
  hasErrors,
  maxRangeEnd,
  type CourtFilters,
  type FilterErrors,
  type Setting,
  type Surface,
} from '@/pages/courts/filters'
import { surfaceLabel } from '@/pages/courts/format'

/** Chip meaning "no surface filter"; never sent to the API. */
const ANY_SURFACE = 'ALL'
type SurfaceChip = Surface | typeof ANY_SURFACE

const SURFACE_OPTIONS: FilterOption<SurfaceChip>[] = [
  { value: ANY_SURFACE, label: 'All' },
  ...(['CLAY', 'HARD', 'GRASS', 'SYNTHETIC'] as const).map((value) => ({
    value,
    label: surfaceLabel(value),
  })),
]

const SETTING_OPTIONS: FilterOption<Setting>[] = [
  { value: 'all', label: 'All' },
  { value: 'indoor', label: 'Indoor' },
  { value: 'outdoor', label: 'Outdoor' },
]

const toOptions = (times: string[]): SelectOption[] =>
  times.map((time) => ({ value: time, label: time }))
const START_OPTIONS = toOptions(START_TIMES)
const END_OPTIONS = toOptions(END_TIMES)

export type CourtFiltersPanelProps = {
  filters: CourtFilters
  errors: FilterErrors
  /** Viewer's today `YYYY-MM-DD` — earliest selectable date. */
  today: string
  clubOptions: SelectOption[]
  /** Labels for selected clubs that may not be in `clubOptions` yet. */
  selectedClubOptions: SelectOption[]
  clubsLoading: boolean
  clubsError: boolean
  /** Called when the clubs menu opens, so the club list can load on demand. */
  onClubsOpen: () => void
  onChange: (next: CourtFilters) => void
  onClear: () => void
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-clay">{message}</p> : null
}

export function CourtFiltersPanel({
  filters,
  errors,
  today,
  clubOptions,
  selectedClubOptions,
  clubsLoading,
  clubsError,
  onClubsOpen,
  onChange,
  onClear,
}: CourtFiltersPanelProps) {
  const activeCount = activeFilterCount(filters)
  const update = (patch: Partial<CourtFilters>) => onChange({ ...filters, ...patch })

  return (
    // Errors must be visible to be fixed: keep the panel open on phones.
    <FilterPanel
      activeCount={activeCount}
      onClear={onClear}
      forceOpen={hasErrors(errors)}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <FilterGroup
            multiple
            label="Surface"
            aria-label="Surface"
            exclusiveValue={ANY_SURFACE}
            options={SURFACE_OPTIONS}
            value={filters.surfaces.length > 0 ? filters.surfaces : [ANY_SURFACE]}
            onChange={(next) =>
              update({
                surfaces: next.filter((value): value is Surface => value !== ANY_SURFACE),
              })
            }
          />
          <FieldError message={errors.surfaces} />
        </div>

        <div className="space-y-2">
          <FilterGroup
            label="Setting"
            aria-label="Setting"
            options={SETTING_OPTIONS}
            value={filters.setting}
            onChange={(setting) => update({ setting })}
          />
          <FieldError message={errors.setting} />
        </div>
      </div>

      <Select
        multiple
        label="Clubs"
        placeholder="All clubs"
        searchPlaceholder="Search clubs…"
        options={clubOptions}
        selectedOptions={selectedClubOptions}
        value={filters.clubs}
        onChange={(clubs) => update({ clubs })}
        onSearchChange={onClubsOpen}
        filterLocally
        searchDebounceMs={0}
        loading={clubsLoading}
        error={errors.clubs}
        hint={
          clubsError ? "Couldn't load your clubs. Close and reopen to retry." : undefined
        }
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <DatePicker
          label="Date"
          placeholder="Today"
          value={filters.dateFrom}
          min={today}
          onChange={(dateFrom) => update({ dateFrom })}
          error={errors.dateFrom}
          hint="Leave empty for today."
        />
        <DatePicker
          label="End date"
          placeholder="No end date"
          value={filters.dateTo}
          min={filters.dateFrom || today}
          max={filters.dateFrom ? maxRangeEnd(filters.dateFrom) : undefined}
          onChange={(dateTo) => update({ dateTo })}
          error={errors.dateTo}
          hint={`Optional — ranges span up to ${MAX_WINDOW_DAYS} days.`}
        />
        <Select
          label="Earliest start"
          placeholder="Any time"
          searchPlaceholder="Search times…"
          options={START_OPTIONS}
          value={filters.timeFrom}
          onChange={(timeFrom) => update({ timeFrom })}
          error={errors.timeFrom}
        />
        <Select
          label="Latest end"
          placeholder="Any time"
          searchPlaceholder="Search times…"
          options={END_OPTIONS}
          value={filters.timeTo}
          onChange={(timeTo) => update({ timeTo })}
          error={errors.timeTo}
        />
      </div>

      {errors.general ? <Alert>{errors.general}</Alert> : null}
    </FilterPanel>
  )
}
