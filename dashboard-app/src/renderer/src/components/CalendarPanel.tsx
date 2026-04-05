import React, { useEffect, useMemo } from 'react'
import { useCalendarStore } from '../stores/calendarStore'
import { useAppStore } from '../stores/appStore'
import { GOOGLE_CALENDAR_COLOR_MAP } from '@shared/types'
import type { CalendarEvent } from '@shared/types'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getEventColor(colorId: string): string {
  return GOOGLE_CALENDAR_COLOR_MAP[colorId] ?? '#039be5'
}

function getEventTime(event: CalendarEvent): string {
  if (event.start.dateTime) {
    return new Date(event.start.dateTime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }
  return 'All day'
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
}

export const CalendarPanel: React.FC = () => {
  const events = useCalendarStore((s) => s.events)
  const fetchEvents = useCalendarStore((s) => s.fetchEvents)
  const selectedDate = useCalendarStore((s) => s.selectedDate)
  const setSelectedDate = useCalendarStore((s) => s.setSelectedDate)
  const authStatus = useAppStore((s) => s.authStatus)
  const settings = useAppStore((s) => s.settings)

  const today = useMemo(() => new Date(), [])
  const [viewYear, viewMonth] = useMemo(() => [today.getFullYear(), today.getMonth()], [today])

  useEffect(() => {
    const start = new Date(viewYear, viewMonth, 1).toISOString()
    const end = new Date(viewYear, viewMonth + 1, 0).toISOString()
    void fetchEvents(start, end)

    const intervalMs = (settings?.calendar.refreshIntervalMinutes ?? 2) * 60 * 1000
    const interval = setInterval(() => void fetchEvents(start, end), intervalMs)
    return () => clearInterval(interval)
  }, [viewYear, viewMonth, fetchEvents, settings?.calendar.refreshIntervalMinutes])

  const calendarGrid = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const cells: (number | null)[] = []

    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)

    return cells
  }, [viewYear, viewMonth])

  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>()
    for (const event of events) {
      const dateStr = event.start.dateTime || event.start.date
      if (!dateStr) continue
      const d = new Date(dateStr)
      if (d.getMonth() === viewMonth && d.getFullYear() === viewYear) {
        const day = d.getDate()
        const existing = map.get(day) ?? []
        existing.push(event)
        map.set(day, existing)
      }
    }
    return map
  }, [events, viewMonth, viewYear])

  const todayEvents = useMemo(() => {
    return events
      .filter((e) => {
        const dateStr = e.start.dateTime || e.start.date
        if (!dateStr) return false
        return isSameDay(new Date(dateStr), today)
      })
      .slice(0, settings?.calendar.maxEventsPerDay ?? 8)
  }, [events, today, settings?.calendar.maxEventsPerDay])

  const monthName = new Date(viewYear, viewMonth).toLocaleString('en-US', { month: 'long', year: 'numeric' })

  if (!authStatus.isAuthenticated) {
    return (
      <div className="flex flex-col h-full bg-dash-surface rounded-2xl p-6">
        <h2 className="text-dash-text font-semibold mb-4" style={{ fontSize: '28px' }}>
          Calendar
        </h2>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-dash-text-secondary mb-2" style={{ fontSize: '22px' }}>
              Google Calendar not connected
            </p>
            <p className="text-dash-text-secondary" style={{ fontSize: '18px' }}>
              Open Settings to connect your account
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Month Grid */}
      <div className="bg-dash-surface rounded-2xl p-4 flex-shrink-0">
        <h2 className="text-dash-text font-semibold mb-3" style={{ fontSize: '28px' }}>
          {monthName}
        </h2>

        <div className="grid grid-cols-7 gap-1">
          {DAY_NAMES.map((day) => (
            <div
              key={day}
              className="text-center text-dash-text-secondary font-medium py-1"
              style={{ fontSize: '16px' }}
            >
              {day}
            </div>
          ))}

          {calendarGrid.map((day, i) => {
            if (day === null) {
              return <div key={`empty-${i}`} className="p-2" />
            }

            const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()
            const dayEvents = eventsByDay.get(day) ?? []
            const isSelected = selectedDate === `${viewYear}-${viewMonth}-${day}`

            return (
              <div
                key={`day-${day}`}
                className={`relative flex flex-col items-center p-2 rounded-lg transition-colors ${
                  isToday ? 'bg-dash-accent' : isSelected ? 'bg-dash-border' : 'hover:bg-dash-border'
                }`}
                onPointerDown={() => setSelectedDate(`${viewYear}-${viewMonth}-${day}`)}
              >
                <span
                  className={`font-medium ${isToday ? 'text-white' : 'text-dash-text'}`}
                  style={{ fontSize: '18px' }}
                >
                  {day}
                </span>
                {dayEvents.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {dayEvents.slice(0, 3).map((e, j) => (
                      <div
                        key={j}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: getEventColor(e.colorId) }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Today's Agenda */}
      <div className="bg-dash-surface rounded-2xl p-4 flex-1 overflow-hidden">
        <h3 className="text-dash-text font-semibold mb-3" style={{ fontSize: '22px' }}>
          Today&apos;s Agenda
        </h3>

        {todayEvents.length === 0 ? (
          <p className="text-dash-text-secondary" style={{ fontSize: '18px' }}>
            No events today
          </p>
        ) : (
          <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: '300px' }}>
            {todayEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-dash-bg bg-opacity-50"
              >
                <div
                  className="w-1 h-8 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getEventColor(event.colorId) }}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-dash-text truncate"
                    style={{ fontSize: '20px' }}
                  >
                    {event.summary}
                  </p>
                </div>
                <span
                  className="text-dash-text-secondary flex-shrink-0 font-medium"
                  style={{ fontSize: '18px' }}
                >
                  {getEventTime(event)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
