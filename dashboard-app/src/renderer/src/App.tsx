import React, { useEffect } from 'react'
import { ClockDisplay } from './components/ClockDisplay'
import { WeatherWidget } from './components/WeatherWidget'
import { WeatherFullView } from './components/WeatherFullView'
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
    console.log('Dashboard: initializing...')
    loadSettings()
      .then(() => console.log('Dashboard: settings loaded OK'))
      .catch((err) => console.error('Dashboard: settings failed', err))
    loadAuthStatus()
      .then(() => console.log('Dashboard: auth loaded OK'))
      .catch((err) => console.error('Dashboard: auth failed', err))
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
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d1117' }}>
        <span style={{ fontSize: '24px', color: '#8b949e' }}>Loading dashboard...</span>
      </div>
    )
  }

  const isAllView = viewMode === 'everything'
  const showCalendar = viewMode === 'everything' || viewMode === 'calendar'
  const showSlideshow = viewMode === 'everything' || viewMode === 'photos'
  const isWeatherView = viewMode === 'weather-photos'

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: '#0d1117',
        transform: `translate(${uiDriftX}px, ${uiDriftY}px)`,
        transition: 'transform 2s ease-in-out'
      }}
    >
      {/* Top Bar */}
      <header style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        padding: isAllView ? '16px 24px' : '8px 24px',
        flexShrink: 0
      }}>
        {/* Clock — scales down in focused views */}
        <div style={{
          transform: isAllView ? 'scale(1)' : 'scale(0.6)',
          transformOrigin: 'top left',
          transition: 'transform 0.3s ease'
        }}>
          <ClockDisplay />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          {/* Weather widget only in All view */}
          {isAllView && <WeatherWidget />}

          {/* View Mode Tabs */}
          <div className="flex gap-1 bg-dash-surface rounded-2xl p-1" style={{ flexShrink: 0 }}>
            {(Object.entries(VIEW_MODE_LABELS) as [ViewMode, string][]).map(([mode, label]) => (
              <button
                key={mode}
                className={`rounded-xl px-4 py-2 font-medium ${
                  viewMode === mode
                    ? 'bg-dash-accent text-white'
                    : 'text-dash-text-secondary hover:text-dash-text hover:bg-dash-border'
                }`}
                style={{ fontSize: '15px', cursor: 'pointer', border: 'none' }}
                onClick={() => setViewMode(mode)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ display: 'flex', flex: 1, gap: '16px', padding: '0 16px 16px', overflow: 'hidden', minHeight: 0 }}>
        {/* Weather full view */}
        {isWeatherView && (
          <div style={{ flex: 1, height: '100%', minWidth: 0 }}>
            <WeatherFullView />
          </div>
        )}

        {/* Calendar */}
        {showCalendar && (
          <div style={{ width: viewMode === 'calendar' ? '100%' : '55%', height: '100%', flexShrink: 0 }}>
            <CalendarPanel />
          </div>
        )}

        {/* Slideshow */}
        {showSlideshow && (
          <div style={{ flex: 1, height: '100%', minWidth: 0 }}>
            <SlideshowPanel />
          </div>
        )}
      </main>

      {/* Triple-tap zone */}
      <div
        style={{ position: 'fixed', top: 0, right: 0, width: '60px', height: '60px', zIndex: 50 }}
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
