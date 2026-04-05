import { create } from 'zustand'
import type { AppSettings, AuthStatus, OnlineStatus } from '@shared/types'

interface AppState {
  settings: AppSettings | null
  authStatus: AuthStatus
  onlineStatus: OnlineStatus
  showSettings: boolean
  isNightMode: boolean
  uiDriftX: number
  uiDriftY: number

  loadSettings: () => Promise<void>
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>
  loadAuthStatus: () => Promise<void>
  startAuthFlow: () => Promise<void>
  loadOnlineStatus: () => Promise<void>
  toggleSettings: () => void
  setNightMode: (active: boolean) => void
  applyUiDrift: () => void
  restartApp: () => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  settings: null,
  authStatus: { isAuthenticated: false },
  onlineStatus: { nas: false, calendar: false, weather: false },
  showSettings: false,
  isNightMode: false,
  uiDriftX: 0,
  uiDriftY: 0,

  loadSettings: async () => {
    const settings = await window.electronAPI['settings:get']()
    set({ settings })
  },

  updateSettings: async (partial) => {
    await window.electronAPI['settings:set'](partial)
    const settings = await window.electronAPI['settings:get']()
    set({ settings })
  },

  loadAuthStatus: async () => {
    const authStatus = await window.electronAPI['auth:getStatus']()
    set({ authStatus })
  },

  startAuthFlow: async () => {
    const authStatus = await window.electronAPI['settings:openAuthFlow']()
    set({ authStatus })
  },

  loadOnlineStatus: async () => {
    const onlineStatus = await window.electronAPI['app:getOnlineStatus']()
    set({ onlineStatus })
  },

  toggleSettings: () => {
    set((state) => ({ showSettings: !state.showSettings }))
  },

  setNightMode: (active) => {
    set({ isNightMode: active })
  },

  applyUiDrift: () => {
    const settings = get().settings
    if (!settings?.burnInPrevention.enabled) return
    const maxPx = settings.burnInPrevention.uiDriftPx
    const x = Math.round((Math.random() - 0.5) * 2 * maxPx)
    const y = Math.round((Math.random() - 0.5) * 2 * maxPx)
    set({ uiDriftX: x, uiDriftY: y })
  },

  restartApp: async () => {
    await window.electronAPI['app:restart']()
  }
}))
