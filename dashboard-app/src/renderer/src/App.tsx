import React, { useEffect } from 'react'
import { ClockDisplay } from './components/ClockDisplay'
import { WeatherWidget } from './components/WeatherWidget'
import { CalendarPanel } from './components/CalendarPanel'
import { SlideshowPanel } from './components/SlideshowPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { OfflineOverlay } from './components/OfflineOverlay'
import { NightModeOverlay } from './components/NightModeOverlay'
import { useAppStore } from './stores/appStore'
import { useTripleTap } from './hooks/useTripleTap'

const App: React.FC = () => {
  const settings = useAppStore((s) => s.settings)
  const showSettings = useAppStore((s) => s.showSettings)
  const loadSettings = useAppStore((s) => s.loadSettings)
  const loadAuthStatus = useAppStore((s) => s.loadAuthStatus)
  const toggleSettings = useAppStore((s) => s.toggleSettings)
  const applyUiDrift = useAppStore((s) => s.applyUiDrift)
  const uiDriftX = useAppStore((s) => s.uiDriftX)
  const uiDriftY = useAppStore((s) => s.uiDriftY)

  const tripleTap = useTripleTap(toggleSettings)

  // Initial load
  useEffect(() => {
    void loadSettings()
    void loadAuthStatus()
  }, [loadSettings, loadAuthStatus])

  // Listen for push events from main process
  useEffect(() => {
    const unsubConfig = window.electronAPI.onPushEvent('config:changed', (config) => {
      useAppStore.setState({ settings: config })
    })
    const unsubAuth = window.electronAPI.onPushEvent('auth:changed', (auth) => {
      useAppStore.setState({ authStatus: auth })
    })
    return () => {
      unsubConfig()
      unsubAuth()
    }
  }, [])

  // Keyboard shortcut: F2 to toggle settings (dev convenience)
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'F2') {
        toggleSettings()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleSettings])

  // UI drift for burn-in prevention
  useEffect(() => {
    if (!settings?.burnInPrevention.enabled) return
    const intervalMs = (settings.burnInPrevention.uiDriftIntervalMinutes ?? 30) * 60 * 1000
    const interval = setInterval(applyUiDrift, intervalMs)
    return () => clearInterval(interval)
  }, [settings?.burnInPrevention.enabled, settings?.burnInPrevention.uiDriftIntervalMinutes, applyUiDrift])

  if (!settings) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-dash-bg">
        <span className="text-dash-text-secondary" style={{ fontSize: '24px' }}>Loading...</span>
      </div>
    )
  }

  return (
    <div
      className="w-screen h-screen flex flex-col overflow-hidden bg-dash-bg"
      style={{
        transform: `translate(${uiDriftX}px, ${uiDriftY}px)`,
        transition: 'transform 2s ease-in-out'
      }}
    >
      {/* Top Bar */}
      <header className="flex items-start justify-between px-6 py-4 flex-shrink-0" style={{ height: '160px' }}>
        {settings.display.showClock && <ClockDisplay />}
        {settings.display.showWeather && <WeatherWidget />}
      </header>

      {/* Main Content */}
      <main className="flex flex-1 gap-4 px-4 pb-4 overflow-hidden min-h-0">
        {settings.display.showCalendar && (
          <div className="h-full" style={{ width: '55%', minHeight: 0 }}>
            <CalendarPanel />
          </div>
        )}
        {settings.display.showSlideshow && (
          <div className="h-full flex-1" style={{ minHeight: 0 }}>
            <SlideshowPanel />
          </div>
        )}
      </main>

      {/* Triple-tap zone (top-right corner, 60x60px) */}
      <div
        className="fixed top-0 right-0 z-50"
        style={{ width: '60px', height: '60px' }}
        {...tripleTap}
      />

      {/* Overlays */}
      <OfflineOverlay />
      <NightModeOverlay />
      {showSettings && <SettingsPanel />}
    </div>
  )
}

export default App
