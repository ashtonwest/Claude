import { create } from 'zustand'
import type { CalendarEvent, CalendarView } from '@shared/types'

interface CalendarState {
  events: CalendarEvent[]
  loading: boolean
  lastFetched: number | null
  error: string | null
  selectedDate: string | null
  calendarView: CalendarView
  viewDate: Date

  fetchEvents: (startDate: string, endDate: string) => Promise<void>
  refresh: () => Promise<void>
  setSelectedDate: (date: string | null) => void
  setCalendarView: (view: CalendarView) => void
  setViewDate: (date: Date) => void
  navigateView: (direction: 1 | -1) => void
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  events: [],
  loading: false,
  lastFetched: null,
  error: null,
  selectedDate: null,
  calendarView: 'month',
  viewDate: new Date(),

  fetchEvents: async (startDate, endDate) => {
    set({ loading: true, error: null })
    try {
      const events = await window.electronAPI['calendar:getEvents'](startDate, endDate)
      set({ events, lastFetched: Date.now(), loading: false })
    } catch (err) {
      set({ error: String(err), loading: false })
    }
  },

  refresh: async () => {
    try {
      await window.electronAPI['calendar:refresh']()
      const now = new Date()
      const start = new Date(now.getFullYear() - 1, 0, 1).toISOString()
      const end = new Date(now.getFullYear() + 1, 11, 31).toISOString()
      const events = await window.electronAPI['calendar:getEvents'](start, end)
      set({ events, lastFetched: Date.now() })
    } catch (err) {
      set({ error: String(err) })
    }
  },

  setSelectedDate: (date) => {
    set({ selectedDate: date })
  },

  setCalendarView: (view) => {
    set({ calendarView: view })
  },

  setViewDate: (date) => {
    set({ viewDate: date })
  },

  navigateView: (direction) => {
    const { calendarView, viewDate } = get()
    const d = new Date(viewDate)
    switch (calendarView) {
      case 'day':
        d.setDate(d.getDate() + direction)
        break
      case 'week':
        d.setDate(d.getDate() + direction * 7)
        break
      case 'month':
        d.setMonth(d.getMonth() + direction)
        break
      case 'year':
        d.setFullYear(d.getFullYear() + direction)
        break
    }
    set({ viewDate: d })
  }
}))
