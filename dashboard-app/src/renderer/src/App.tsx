import React, { useEffect } from 'react'
import { ClockDisplay } from './components/ClockDisplay'
import { WeatherWidget } from './components/WeatherWidget'
import { CalendarPanel } from './components/CalendarPanel'
import { SlideshowPanel } from './components/SlideshowPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { OfflineOverlay } from './components/OfflineOverlay'
import { NightModeOverlay } from './components/NightModeOverlay'
import { useAppStore } from './stores/appStore'
import type { ViewMode } from './stores/appStore'
import { useTripleTap } from './hooks/useTripleTap'

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  'everything': 'All',
  'calendar': 'Calendar',
  'photos': 'Photos',
  'weather-photos': 'Weather'
}

const App: React.FC = () => {
  const settings = useAppStore((s) => s.settings)
  const showSettings = useAppStore((s) => s.showSettings)
  const loadSettings = useAppStore((s) => s.loadSettings)
  const loadAuthStatus = useAppStore((s) => s.loadAuthStatus)
  const toggleSettings = useAppStore((s) => s.toggleSettings)
  const applyUiDrift = useAppStore((s) => s.applyUiDrift)
  const uiDriftX = useAppStore((s) => s.uiDriftX)
  const uiDriftY = useAppStore((s) => s.uiDriftY)
  const viewMode = useAppStore((s) => s.viewMode)
  const setViewMode = useAppStore((s) => s.setViewMode)
  const cycleViewMode = useAppStore((s) => s.cycleViewMode)

  const tripleTap = useTripleTap(toggleSettings)

  useEffect(() => {
    void loadSettings()
    void loadAuthStatus()
  }, [loadSettings, loadAuthStatus])

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

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'F2') toggleSettings()
      if (e.key === 'F3') cycleViewMode()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleSettings, cycleViewMode])

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

  // Determine panel visibility and positioning
  const calendarVisible = viewMode === 'everything' || viewMode === 'calendar'
  const slideshowVisible = viewMode === 'everything' || viewMode === 'photos' || viewMode === 'weather-photos'
  const weatherVisible = viewMode === 'everything' || viewMode === 'weather-photos'

  // Calendar is "on top" when it's the focused view
  const calendarOnTop = viewMode === 'calendar'
  // Slideshow is "on top" when photos or weather-photos
  const slideshowOnTop = viewMode === 'photos' || viewMode === 'weather-photos'

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
        <ClockDisplay />
        <div className="flex items-start gap-3">
          {weatherVisible && <WeatherWidget />}
          {/* View Mode Tabs */}
          <div className="flex gap-1 bg-dash-surface bg-opacity-80 rounded-2xl p-1 flex-shrink-0">
            {(Object.entries(VIEW_MODE_LABELS) as [ViewMode, string][]).map(([mode, label]) => (
              <button
                key={mode}
                className={`rounded-xl px-4 py-2 font-medium transition-all duration-300 ${
                  viewMode === mode
                    ? 'bg-dash-accent text-white shadow-lg'
                    : 'text-dash-text-secondary hover:text-dash-text hover:bg-dash-border'
                }`}
                style={{ fontSize: '15px', cursor: 'pointer' }}
                onClick={() => setViewMode(mode)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content — both panels always rendered, positioned with sliding transforms */}
      <main className="relative flex-1 mx-4 mb-4 overflow-hidden min-h-0">
        {/* Calendar Panel */}
        <div
          className="absolute top-0 bottom-0 transition-all duration-500 ease-in-out"
          style={{
            left: calendarVisible ? '0' : '-60%',
            width: viewMode === 'calendar' ? '100%' : '55%',
            opacity: calendarVisible ? 1 : 0,
            zIndex: calendarOnTop ? 20 : 10,
            cursor: 'pointer'
          }}
          onClick={() => setViewMode(viewMode === 'calendar' ? 'everything' : 'calendar')}
        >
          <CalendarPanel />
        </div>

        {/* Slideshow Panel */}
        <div
          className="absolute top-0 bottom-0 transition-all duration-500 ease-in-out"
          style={{
            right: slideshowVisible ? '0' : '-50%',
            width: viewMode === 'photos' || viewMode === 'weather-photos' ? '100%' : 'calc(45% - 16px)',
            opacity: slideshowVisible ? 1 : 0,
            zIndex: slideshowOnTop ? 20 : 10,
            cursor: 'pointer'
          }}
          onClick={() => setViewMode(viewMode === 'photos' ? 'everything' : 'photos')}
        >
          <SlideshowPanel />
        </div>
      </main>

      {/* Triple-tap zone */}
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
