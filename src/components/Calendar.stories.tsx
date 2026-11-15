import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { Calendar } from '@/components/Calendar'
import { DateField } from '@/components/DateField'
import { DatePicker } from '@/components/DatePicker'
import { parseISODate, toISODate } from '@/components/calendarUtils'

const meta = {
  title: 'Components/Calendar',
} satisfies Meta

export default meta
type Story = StoryObj

export const Month: Story = {
  render: function Render() {
    const [value, setValue] = useState(toISODate(new Date()))
    return <Calendar value={value} onChange={setValue} />
  },
}

export const JumpToMonthOrYear: Story = {
  name: 'Calendar · jump to a month or year',
  parameters: {
    docs: {
      description: {
        story:
          'The month and the year in the header are menus: clicking either jumps straight there, so a distant date takes two clicks instead of dozens. `min`/`max` grey out the months and years that are out of reach.',
      },
    },
  },
  render: function Render() {
    const [value, setValue] = useState('')
    return (
      <div className="space-y-3">
        <Calendar value={value || undefined} onChange={setValue} />
        <p className="text-sm text-fog">Selected: {value || '(none)'}</p>
      </div>
    )
  },
}

export const DateFieldWithCalendar: Story = {
  render: function Render() {
    const [value, setValue] = useState(toISODate(new Date()))
    return (
      <DateField
        label="Play date"
        value={value}
        onChange={setValue}
        hint="Availability window is up to 7 days."
      />
    )
  },
}

/** Calendar-day arithmetic (safe across DST changes). */
function addDays(isoDate: string, days: number): string {
  const date = parseISODate(isoDate)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

export const DatePickerDropdown: Story = {
  name: 'DatePicker · dropdown',
  render: function Render() {
    const [value, setValue] = useState('')
    return (
      <div className="max-w-sm">
        <DatePicker
          label="Play date"
          placeholder="Today"
          value={value}
          onChange={setValue}
          min={toISODate(new Date())}
          hint="Leave empty for today."
        />
      </div>
    )
  },
}

export const DatePickerRange: Story = {
  name: 'DatePicker · range (max 7 days)',
  render: function Render() {
    const today = toISODate(new Date())
    const [from, setFrom] = useState('')
    const [to, setTo] = useState('')
    const maxTo = from ? addDays(from, 6) : undefined
    return (
      <div className="grid max-w-2xl gap-5 sm:grid-cols-2">
        <DatePicker
          label="Date"
          placeholder="Today"
          value={from}
          onChange={setFrom}
          min={today}
        />
        <DatePicker
          label="End date"
          placeholder="No end date"
          value={to}
          onChange={setTo}
          min={from || today}
          max={maxTo}
          hint="Optional — ranges span up to 7 days."
        />
      </div>
    )
  },
}

export const DatePickerError: Story = {
  name: 'DatePicker · error',
  render: () => (
    <div className="max-w-sm">
      <DatePicker
        label="End date"
        value={toISODate(new Date())}
        onChange={() => {}}
        error="Must be on or after the start date."
      />
    </div>
  ),
}
