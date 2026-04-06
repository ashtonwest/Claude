import { create } from 'zustand'
import type { AppSettings, AuthStatus, OnlineStatus, GoogleAccount } from '@shared/types'

export type ViewMode = 'everything' | 'calendar' | 'photos' | 'weather-photos'

const VIEW_MODES: ViewMode[] = ['everything', 'calendar', 'photos', 'weather-photos']

interface AppState {
  settings: AppSettings | null
  authStatus: AuthStatus
  onlineStatus: OnlineStatus
  showSettings: boolean
  isNightMode: boolean
  uiDriftX: number
  uiDriftY: number
  viewMode: ViewMode

  loadSettings: () => Promise<void>
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>
  loadAuthStatus: () => Promise<void>
  startAuthFlow: () => Promise<void>
  addAccount: () => Promise<void>
  removeAccount: (accountId: string) => Promise<void>
  loadOnlineStatus: () => Promise<void>
  toggleSettings: () => void
  setNightMode: (active: boolean) => void
  applyUiDrift: () => void
  restartApp: () => Promise<void>
  cycleViewMode: () => void
  setViewMode: (mode: ViewMode) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  settings: null,
  authStatus: { isAuthenticated: false, accounts: [] },
  onlineStatus: { nas: false, calendar: false, weather: false },
  showSettings: false,
  isNightMode: false,
  uiDriftX: 0,
  uiDriftY: 0,
  viewMode: 'everything',

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

  addAccount: async () => {
    await window.electronAPI['auth:addAccount']()
    const authStatus = await window.electronAPI['auth:getStatus']()
    set({ authStatus })
  },

  removeAccount: async (accountId: string) => {
    await window.electronAPI['auth:removeAccount'](accountId)
    const authStatus = await window.electronAPI['auth:getStatus']()
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
  },

  cycleViewMode: () => {
    set((state) => {
      const currentIdx = VIEW_MODES.indexOf(state.viewMode)
      const nextIdx = (currentIdx + 1) % VIEW_MODES.length
      return { viewMode: VIEW_MODES[nextIdx] as ViewMode }
    })
  },

  setViewMode: (mode) => {
    set({ viewMode: mode })
  }
}))
