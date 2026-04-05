import React, { useEffect, useMemo } from 'react'
import { useCalendarStore } from '../stores/calendarStore'
import { useWeatherStore } from '../stores/weatherStore'
import { useAppStore } from '../stores/appStore'
import { GOOGLE_CALENDAR_COLOR_MAP, WMO_WEATHER_CODES } from '@shared/types'
import type { CalendarEvent, WeatherDaily } from '@shared/types'

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

function daysBetween(d1: Date, d2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000
  return Math.round((d2.getTime() - d1.getTime()) / oneDay)
}

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const CalendarPanel: React.FC = () => {
  const events = useCalendarStore((s) => s.events)
  const fetchEvents = useCalendarStore((s) => s.fetchEvents)
  const selectedDate = useCalendarStore((s) => s.selectedDate)
  const setSelectedDate = useCalendarStore((s) => s.setSelectedDate)
  const authStatus = useAppStore((s) => s.authStatus)
  const settings = useAppStore((s) => s.settings)
  const weather = useWeatherStore((s) => s.weather)

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

  // Build a weather lookup by date string
  const weatherByDate = useMemo(() => {
    const map = new Map<string, WeatherDaily>()
    if (weather?.daily) {
      for (const day of weather.daily) {
        map.set(day.date, day)
      }
    }
    return map
  }, [weather])

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

  // Get selected date info
  const selectedInfo = useMemo(() => {
    if (!selectedDate) return null
    const parts = selectedDate.split('-').map(Number)
    const year = parts[0] ?? viewYear
    const month = parts[1] ?? viewMonth
    const day = parts[2] ?? 1
    const date = new Date(year, month, day)
    const daysFromToday = daysBetween(today, date)
    const dateKey = formatDateKey(date)
    const dayWeather = weatherByDate.get(dateKey)
    const dayEvents = eventsByDay.get(day) ?? []

    return { date, day, daysFromToday, dayWeather, dayEvents, dateKey }
  }, [selectedDate, viewYear, viewMonth, today, weatherByDate, eventsByDay])

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

            // Show weather icon on days within 15 days
            const cellDate = new Date(viewYear, viewMonth, day)
            const daysAway = daysBetween(today, cellDate)
            const dateKey = formatDateKey(cellDate)
            const cellWeather = daysAway >= 0 && daysAway <= 15 ? weatherByDate.get(dateKey) : undefined

            return (
              <div
                key={`day-${day}`}
                className={`relative flex flex-col items-center p-1.5 rounded-lg transition-colors ${
                  isToday ? 'bg-dash-accent' : isSelected ? 'bg-dash-border' : 'hover:bg-dash-border'
                }`}
                style={{ cursor: 'pointer' }}
                onPointerDown={() => setSelectedDate(isSelected ? null : `${viewYear}-${viewMonth}-${day}`)}
              >
                <span
                  className={`font-medium ${isToday ? 'text-white' : 'text-dash-text'}`}
                  style={{ fontSize: '18px' }}
                >
                  {day}
                </span>
                <div className="flex items-center gap-0.5 mt-0.5 h-4">
                  {cellWeather && (
                    <span style={{ fontSize: '12px', lineHeight: 1 }}>
                      {WMO_WEATHER_CODES[cellWeather.weatherCode]?.icon ?? ''}
                    </span>
                  )}
                  {dayEvents.slice(0, 2).map((e, j) => (
                    <div
                      key={j}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: getEventColor(e.colorId) }}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Selected Date Weather + Events OR Today's Agenda */}
      <div className="bg-dash-surface rounded-2xl p-4 flex-1 overflow-hidden">
        {selectedInfo ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-dash-text font-semibold" style={{ fontSize: '22px' }}>
                {selectedInfo.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </h3>
              <button
                className="text-dash-text-secondary hover:text-dash-text px-2"
                style={{ fontSize: '18px', cursor: 'pointer' }}
                onClick={() => setSelectedDate(null)}
              >
                Back
              </button>
            </div>

            {/* Weather forecast for selected date */}
            {selectedInfo.dayWeather && selectedInfo.daysFromToday >= 0 && selectedInfo.daysFromToday <= 15 && (
              <div className="bg-dash-bg bg-opacity-50 rounded-xl p-3 mb-3 flex items-center gap-4">
                <span style={{ fontSize: '32px' }}>
                  {WMO_WEATHER_CODES[selectedInfo.dayWeather.weatherCode]?.icon ?? '🌡️'}
                </span>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-dash-text font-bold" style={{ fontSize: '24px' }}>
                      {Math.round(selectedInfo.dayWeather.maxTemp)}&deg; / {Math.round(selectedInfo.dayWeather.minTemp)}&deg;
                    </span>
                    <span className="text-dash-text-secondary" style={{ fontSize: '16px' }}>
                      {weather?.units === 'fahrenheit' ? 'F' : 'C'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-dash-text-secondary" style={{ fontSize: '14px' }}>
                    <span>{WMO_WEATHER_CODES[selectedInfo.dayWeather.weatherCode]?.description ?? 'Unknown'}</span>
                    <span>💧 {selectedInfo.dayWeather.precipitationProbability}% rain</span>
                    {selectedInfo.daysFromToday > 0 && (
                      <span className="text-dash-text-secondary italic">
                        {selectedInfo.daysFromToday === 1 ? 'Tomorrow' : `${selectedInfo.daysFromToday} days out`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {selectedInfo.daysFromToday > 15 && (
              <div className="bg-dash-bg bg-opacity-50 rounded-xl p-3 mb-3">
                <p className="text-dash-text-secondary" style={{ fontSize: '14px' }}>
                  Weather forecast not available beyond 15 days
                </p>
              </div>
            )}

            {/* Events for selected date */}
            {selectedInfo.dayEvents.length === 0 ? (
              <p className="text-dash-text-secondary" style={{ fontSize: '18px' }}>
                No events this day
              </p>
            ) : (
              <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: '250px' }}>
                {selectedInfo.dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-dash-bg bg-opacity-50"
                  >
                    <div
                      className="w-1 h-8 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getEventColor(event.colorId) }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-dash-text truncate" style={{ fontSize: '20px' }}>
                        {event.summary}
                      </p>
                    </div>
                    <span className="text-dash-text-secondary flex-shrink-0 font-medium" style={{ fontSize: '18px' }}>
                      {getEventTime(event)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
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
                      <p className="text-dash-text truncate" style={{ fontSize: '20px' }}>
                        {event.summary}
                      </p>
                    </div>
                    <span className="text-dash-text-secondary flex-shrink-0 font-medium" style={{ fontSize: '18px' }}>
                      {getEventTime(event)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
