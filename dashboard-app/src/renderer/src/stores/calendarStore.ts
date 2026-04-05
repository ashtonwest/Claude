import { create } from 'zustand'
import type { CalendarEvent } from '@shared/types'

interface CalendarState {
  events: CalendarEvent[]
  loading: boolean
  lastFetched: number | null
  error: string | null
  selectedDate: string | null

  fetchEvents: (startDate: string, endDate: string) => Promise<void>
  refresh: () => Promise<void>
  setSelectedDate: (date: string | null) => void
}

export const useCalendarStore = create<CalendarState>((set) => ({
  events: [],
  loading: false,
  lastFetched: null,
  error: null,
  selectedDate: null,

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
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString()
      const events = await window.electronAPI['calendar:getEvents'](start, end)
      set({ events, lastFetched: Date.now() })
    } catch (err) {
      set({ error: String(err) })
    }
  },

  setSelectedDate: (date) => {
    set({ selectedDate: date })
  }
}))
