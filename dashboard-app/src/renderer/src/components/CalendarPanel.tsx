import React, { useEffect, useMemo, useCallback } from 'react'
import { useCalendarStore } from '../stores/calendarStore'
import { useWeatherStore } from '../stores/weatherStore'
import { useAppStore } from '../stores/appStore'
import { GOOGLE_CALENDAR_COLOR_MAP, WMO_WEATHER_CODES } from '@shared/types'
import type { CalendarEvent, CalendarView, WeatherDaily } from '@shared/types'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const VIEWS: CalendarView[] = ['day', 'week', 'month', 'year']

function getEventColor(colorId: string): string {
  return GOOGLE_CALENDAR_COLOR_MAP[colorId] ?? '#039be5'
}

function getEventTime(event: CalendarEvent): string {
  if (event.start.dateTime) {
    return new Date(event.start.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }
  return 'All day'
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()
}

function daysBetween(d1: Date, d2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000
  return Math.round((d2.getTime() - d1.getTime()) / oneDay)
}

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getEventsForDate(events: CalendarEvent[], date: Date): CalendarEvent[] {
  return events.filter((e) => {
    const dateStr = e.start.dateTime || e.start.date
    if (!dateStr) return false
    return isSameDay(new Date(dateStr), date)
  })
}

// --- Event List Component ---
const EventList: React.FC<{ events: CalendarEvent[]; maxHeight?: string }> = ({ events, maxHeight = '200px' }) => (
  <div className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight }}>
    {events.map((event) => (
      <div key={event.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-dash-bg bg-opacity-50">
        <div className="w-1 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: getEventColor(event.colorId) }} />
        <span className="text-dash-text truncate flex-1" style={{ fontSize: '16px' }}>{event.summary}</span>
        <span className="text-dash-text-secondary flex-shrink-0" style={{ fontSize: '14px' }}>{getEventTime(event)}</span>
      </div>
    ))}
  </div>
)

// --- Day View ---
const DayView: React.FC<{ events: CalendarEvent[]; viewDate: Date; weatherByDate: Map<string, WeatherDaily>; today: Date }> = ({ events, viewDate, weatherByDate, today }) => {
  const dayEvents = getEventsForDate(events, viewDate)
  const dateKey = formatDateKey(viewDate)
  const dayWeather = weatherByDate.get(dateKey)
  const daysAway = daysBetween(today, viewDate)

  return (
    <div className="flex flex-col h-full gap-3" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <h2 className="text-dash-text font-semibold" style={{ fontSize: '24px' }}>
          {viewDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </h2>
      </div>

      {dayWeather && daysAway >= 0 && daysAway <= 15 && (
        <div className="bg-dash-bg bg-opacity-50 rounded-xl p-3 flex items-center gap-4">
          <span style={{ fontSize: '28px' }}>{WMO_WEATHER_CODES[dayWeather.weatherCode]?.icon ?? '🌡️'}</span>
          <span className="text-dash-text font-bold" style={{ fontSize: '22px' }}>
            {Math.round(dayWeather.maxTemp)}&deg; / {Math.round(dayWeather.minTemp)}&deg;
          </span>
          <span className="text-dash-text-secondary" style={{ fontSize: '14px' }}>
            {WMO_WEATHER_CODES[dayWeather.weatherCode]?.description} — 💧 {dayWeather.precipitationProbability}%
          </span>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {dayEvents.length === 0 ? (
          <p className="text-dash-text-secondary" style={{ fontSize: '18px' }}>No events</p>
        ) : (
          <EventList events={dayEvents} maxHeight="100%" />
        )}
      </div>
    </div>
  )
}

// --- Week View ---
const WeekView: React.FC<{ events: CalendarEvent[]; viewDate: Date; weatherByDate: Map<string, WeatherDaily>; today: Date }> = ({ events, viewDate, weatherByDate, today }) => {
  const weekStart = useMemo(() => {
    const d = new Date(viewDate)
    d.setDate(d.getDate() - d.getDay())
    return d
  }, [viewDate])

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [weekStart])

  return (
    <div className="flex flex-col h-full gap-2" onClick={(e) => e.stopPropagation()}>
      <div className="grid grid-cols-7 gap-1 flex-1 min-h-0">
        {days.map((day) => {
          const dayEvents = getEventsForDate(events, day)
          const isToday = isSameDay(day, today)
          const dateKey = formatDateKey(day)
          const daysAway = daysBetween(today, day)
          const dayWeather = daysAway >= 0 && daysAway <= 15 ? weatherByDate.get(dateKey) : undefined

          return (
            <div
              key={day.toISOString()}
              className={`flex flex-col rounded-lg p-2 overflow-hidden ${isToday ? 'bg-dash-accent bg-opacity-20 border border-dash-accent' : 'bg-dash-bg bg-opacity-30'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`font-semibold ${isToday ? 'text-dash-accent' : 'text-dash-text'}`} style={{ fontSize: '14px' }}>
                  {DAY_NAMES[day.getDay()]} {day.getDate()}
                </span>
                {dayWeather && (
                  <span style={{ fontSize: '12px' }}>{WMO_WEATHER_CODES[dayWeather.weatherCode]?.icon}</span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto">
                {dayEvents.slice(0, 4).map((e) => (
                  <div key={e.id} className="flex items-center gap-1 mb-0.5">
                    <div className="w-1 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: getEventColor(e.colorId) }} />
                    <span className="text-dash-text truncate" style={{ fontSize: '12px' }}>{e.summary}</span>
                  </div>
                ))}
                {dayEvents.length > 4 && (
                  <span className="text-dash-text-secondary" style={{ fontSize: '11px' }}>+{dayEvents.length - 4} more</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- Month View ---
const MonthView: React.FC<{ events: CalendarEvent[]; viewDate: Date; weatherByDate: Map<string, WeatherDaily>; today: Date; selectedDate: string | null; setSelectedDate: (d: string | null) => void }> = ({ events, viewDate, weatherByDate, today, selectedDate, setSelectedDate }) => {
  const viewYear = viewDate.getFullYear()
  const viewMonth = viewDate.getMonth()

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

  const selectedInfo = useMemo(() => {
    if (!selectedDate) return null
    const parts = selectedDate.split('-').map(Number)
    const date = new Date(parts[0] ?? viewYear, parts[1] ?? viewMonth, parts[2] ?? 1)
    const daysFromToday = daysBetween(today, date)
    const dateKey = formatDateKey(date)
    const dayWeather = weatherByDate.get(dateKey)
    const dayEvents = eventsByDay.get(parts[2] ?? 1) ?? []
    return { date, daysFromToday, dayWeather, dayEvents }
  }, [selectedDate, viewYear, viewMonth, today, weatherByDate, eventsByDay])

  return (
    <div className="flex flex-col h-full gap-2" onClick={(e) => e.stopPropagation()}>
      <div className="grid grid-cols-7 gap-1">
        {DAY_NAMES.map((day) => (
          <div key={day} className="text-center text-dash-text-secondary font-medium py-0.5" style={{ fontSize: '13px' }}>{day}</div>
        ))}
        {calendarGrid.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} className="p-1" />
          const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()
          const dayEvents = eventsByDay.get(day) ?? []
          const isSelected = selectedDate === `${viewYear}-${viewMonth}-${day}`
          const cellDate = new Date(viewYear, viewMonth, day)
          const daysAway = daysBetween(today, cellDate)
          const dateKey = formatDateKey(cellDate)
          const cellWeather = daysAway >= 0 && daysAway <= 15 ? weatherByDate.get(dateKey) : undefined

          return (
            <div
              key={`d-${day}`}
              className={`flex flex-col items-center p-1 rounded-lg transition-colors ${isToday ? 'bg-dash-accent' : isSelected ? 'bg-dash-border' : 'hover:bg-dash-border'}`}
              style={{ cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); setSelectedDate(isSelected ? null : `${viewYear}-${viewMonth}-${day}`) }}
            >
              <span className={`font-medium ${isToday ? 'text-white' : 'text-dash-text'}`} style={{ fontSize: '16px' }}>{day}</span>
              <div className="flex items-center gap-0.5 h-3">
                {cellWeather && <span style={{ fontSize: '10px', lineHeight: 1 }}>{WMO_WEATHER_CODES[cellWeather.weatherCode]?.icon}</span>}
                {dayEvents.slice(0, 2).map((e, j) => (
                  <div key={j} className="w-1 h-1 rounded-full" style={{ backgroundColor: getEventColor(e.colorId) }} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom: selected date detail or today's agenda */}
      <div className="bg-dash-surface rounded-xl p-3 flex-1 overflow-hidden min-h-0">
        {selectedInfo ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-dash-text font-semibold" style={{ fontSize: '18px' }}>
                {selectedInfo.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              <button className="text-dash-text-secondary" style={{ fontSize: '14px', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setSelectedDate(null) }}>Back</button>
            </div>
            {selectedInfo.dayWeather && selectedInfo.daysFromToday >= 0 && selectedInfo.daysFromToday <= 15 && (
              <div className="flex items-center gap-2 mb-2 text-dash-text-secondary" style={{ fontSize: '14px' }}>
                <span>{WMO_WEATHER_CODES[selectedInfo.dayWeather.weatherCode]?.icon}</span>
                <span>{Math.round(selectedInfo.dayWeather.maxTemp)}&deg;/{Math.round(selectedInfo.dayWeather.minTemp)}&deg;</span>
                <span>💧 {selectedInfo.dayWeather.precipitationProbability}%</span>
              </div>
            )}
            {selectedInfo.dayEvents.length === 0 ? (
              <p className="text-dash-text-secondary" style={{ fontSize: '14px' }}>No events</p>
            ) : (
              <EventList events={selectedInfo.dayEvents} maxHeight="200px" />
            )}
          </div>
        ) : (
          <div>
            <span className="text-dash-text font-semibold" style={{ fontSize: '18px' }}>Today</span>
            {getEventsForDate(events, today).length === 0 ? (
              <p className="text-dash-text-secondary mt-1" style={{ fontSize: '14px' }}>No events today</p>
            ) : (
              <div className="mt-1"><EventList events={getEventsForDate(events, today).slice(0, 5)} maxHeight="200px" /></div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// --- Year View ---
const YearView: React.FC<{ events: CalendarEvent[]; viewDate: Date; today: Date; setViewDate: (d: Date) => void; setCalendarView: (v: CalendarView) => void }> = ({ events, viewDate, today, setViewDate, setCalendarView }) => {
  const year = viewDate.getFullYear()

  const eventCountByMonth = useMemo(() => {
    const counts = new Map<number, number>()
    for (const event of events) {
      const dateStr = event.start.dateTime || event.start.date
      if (!dateStr) continue
      const d = new Date(dateStr)
      if (d.getFullYear() === year) {
        const m = d.getMonth()
        counts.set(m, (counts.get(m) ?? 0) + 1)
      }
    }
    return counts
  }, [events, year])

  return (
    <div className="h-full" onClick={(e) => e.stopPropagation()}>
      <div className="grid grid-cols-4 gap-3 h-full">
        {MONTH_NAMES.map((name, i) => {
          const isCurrentMonth = i === today.getMonth() && year === today.getFullYear()
          const count = eventCountByMonth.get(i) ?? 0
          return (
            <div
              key={name}
              className={`rounded-xl p-3 flex flex-col items-center justify-center transition-colors ${isCurrentMonth ? 'bg-dash-accent bg-opacity-20 border border-dash-accent' : 'bg-dash-bg bg-opacity-30 hover:bg-dash-border'}`}
              style={{ cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); setViewDate(new Date(year, i, 1)); setCalendarView('month') }}
            >
              <span className={`font-semibold ${isCurrentMonth ? 'text-dash-accent' : 'text-dash-text'}`} style={{ fontSize: '20px' }}>{name}</span>
              {count > 0 && (
                <span className="text-dash-text-secondary mt-1" style={{ fontSize: '13px' }}>{count} events</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- Main CalendarPanel ---
export const CalendarPanel: React.FC = () => {
  const events = useCalendarStore((s) => s.events)
  const fetchEvents = useCalendarStore((s) => s.fetchEvents)
  const selectedDate = useCalendarStore((s) => s.selectedDate)
  const setSelectedDate = useCalendarStore((s) => s.setSelectedDate)
  const calendarView = useCalendarStore((s) => s.calendarView)
  const setCalendarView = useCalendarStore((s) => s.setCalendarView)
  const viewDate = useCalendarStore((s) => s.viewDate)
  const setViewDate = useCalendarStore((s) => s.setViewDate)
  const navigateView = useCalendarStore((s) => s.navigateView)
  const authStatus = useAppStore((s) => s.authStatus)
  const settings = useAppStore((s) => s.settings)
  const weather = useWeatherStore((s) => s.weather)

  const today = useMemo(() => new Date(), [])
  const viewYear = viewDate.getFullYear()

  useEffect(() => {
    const start = new Date(viewYear, 0, 1).toISOString()
    const end = new Date(viewYear, 11, 31).toISOString()
    void fetchEvents(start, end)

    const intervalMs = (settings?.calendar.refreshIntervalMinutes ?? 2) * 60 * 1000
    const interval = setInterval(() => void fetchEvents(start, end), intervalMs)
    return () => clearInterval(interval)
  }, [viewYear, fetchEvents, settings?.calendar.refreshIntervalMinutes])

  const weatherByDate = useMemo(() => {
    const map = new Map<string, WeatherDaily>()
    if (weather?.daily) {
      for (const day of weather.daily) map.set(day.date, day)
    }
    return map
  }, [weather])

  const viewTitle = useMemo(() => {
    switch (calendarView) {
      case 'day': return viewDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      case 'week': {
        const weekStart = new Date(viewDate)
        weekStart.setDate(weekStart.getDate() - weekStart.getDay())
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 6)
        return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      }
      case 'month': return viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      case 'year': return String(viewYear)
    }
  }, [calendarView, viewDate, viewYear])

  const goToToday = useCallback(() => {
    setViewDate(new Date())
  }, [setViewDate])

  if (!authStatus.isAuthenticated) {
    return (
      <div className="flex flex-col h-full bg-dash-surface rounded-2xl p-6">
        <h2 className="text-dash-text font-semibold mb-4" style={{ fontSize: '28px' }}>Calendar</h2>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-dash-text-secondary mb-2" style={{ fontSize: '22px' }}>No Google accounts connected</p>
            <p className="text-dash-text-secondary" style={{ fontSize: '18px' }}>Open Settings to add an account</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-dash-surface rounded-2xl p-4 gap-2">
      {/* Header: nav + view tabs */}
      <div className="flex items-center justify-between flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <button className="text-dash-text-secondary hover:text-dash-text px-2 py-1 rounded" style={{ fontSize: '20px', cursor: 'pointer' }} onClick={() => navigateView(-1)}>&lt;</button>
          <span className="text-dash-text font-semibold min-w-0" style={{ fontSize: '20px' }}>{viewTitle}</span>
          <button className="text-dash-text-secondary hover:text-dash-text px-2 py-1 rounded" style={{ fontSize: '20px', cursor: 'pointer' }} onClick={() => navigateView(1)}>&gt;</button>
          <button className="text-dash-text-secondary hover:text-dash-text px-2 py-1 rounded-lg bg-dash-bg bg-opacity-50 ml-1" style={{ fontSize: '13px', cursor: 'pointer' }} onClick={goToToday}>Today</button>
        </div>
        <div className="flex gap-1 bg-dash-bg bg-opacity-50 rounded-xl p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${calendarView === v ? 'bg-dash-accent text-white' : 'text-dash-text-secondary hover:text-dash-text'}`}
              style={{ fontSize: '13px', cursor: 'pointer' }}
              onClick={() => setCalendarView(v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* View content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {calendarView === 'day' && <DayView events={events} viewDate={viewDate} weatherByDate={weatherByDate} today={today} />}
        {calendarView === 'week' && <WeekView events={events} viewDate={viewDate} weatherByDate={weatherByDate} today={today} />}
        {calendarView === 'month' && <MonthView events={events} viewDate={viewDate} weatherByDate={weatherByDate} today={today} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />}
        {calendarView === 'year' && <YearView events={events} viewDate={viewDate} today={today} setViewDate={setViewDate} setCalendarView={setCalendarView} />}
      </div>
    </div>
  )
}
