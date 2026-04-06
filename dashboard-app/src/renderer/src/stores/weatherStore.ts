import { create } from 'zustand'
import type { WeatherData } from '@shared/types'

interface WeatherState {
  weather: WeatherData | null
  loading: boolean
  lastFetched: number | null

  fetchWeather: () => Promise<void>
}

export const useWeatherStore = create<WeatherState>((set) => ({
  weather: null,
  loading: false,
  lastFetched: null,

  fetchWeather: async () => {
    set({ loading: true })
    try {
      const weather = await window.electronAPI['weather:getData']()
      set({ weather, lastFetched: Date.now(), loading: false })
    } catch {
      set({ loading: false })
    }
  }
}))
