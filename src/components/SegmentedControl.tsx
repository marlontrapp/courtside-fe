import {
  FilterGroup,
  type FilterGroupSingleProps,
  type FilterOption,
} from '@/components/FilterGroup'

/** @deprecated Prefer `FilterGroup` — kept as a single-select alias. */
export type SegmentOption<T extends string = string> = FilterOption<T>

/** @deprecated Prefer `FilterGroup` — kept as a single-select alias. */
export type SegmentedControlProps<T extends string = string> = FilterGroupSingleProps<T>

/** Single-select filter chips. For multi-select use `FilterGroup` with `multiple`. */
export function SegmentedControl<T extends string = string>(props: SegmentedControlProps<T>) {
  return <FilterGroup {...props} multiple={false} />
}
