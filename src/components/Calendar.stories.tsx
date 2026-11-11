import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { Calendar } from '@/components/Calendar'
import { DateField } from '@/components/DateField'
import { toISODate } from '@/components/calendarUtils'

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
