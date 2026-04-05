import React, { useState } from 'react'
import { useAppStore } from '../stores/appStore'
import type { AppSettings } from '@shared/types'

interface FieldProps {
  label: string
  value: string | number | boolean
  onChange: (value: string) => void
  type?: 'text' | 'number' | 'password'
}

const Field: React.FC<FieldProps> = ({ label, value, onChange, type = 'text' }) => (
  <div className="flex flex-col gap-1">
    <label className="text-dash-text-secondary" style={{ fontSize: '14px' }}>
      {label}
    </label>
    <input
      type={type}
      value={String(value)}
      onChange={(e) => onChange(e.target.value)}
      className="bg-dash-bg border border-dash-border rounded-lg px-3 py-2 text-dash-text outline-none focus:border-dash-accent"
      style={{ fontSize: '16px', cursor: 'auto' }}
    />
  </div>
)

interface ToggleProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

const Toggle: React.FC<ToggleProps> = ({ label, checked, onChange }) => (
  <div className="flex items-center justify-between">
    <span className="text-dash-text" style={{ fontSize: '16px' }}>{label}</span>
    <div
      className={`w-12 h-6 rounded-full transition-colors ${checked ? 'bg-dash-accent' : 'bg-dash-border'}`}
      onPointerDown={() => onChange(!checked)}
    >
      <div
        className={`w-5 h-5 rounded-full bg-white mt-0.5 transition-transform ${
          checked ? 'translate-x-6 ml-0.5' : 'translate-x-0.5'
        }`}
      />
    </div>
  </div>
)

export const SettingsPanel: React.FC = () => {
  const settings = useAppStore((s) => s.settings)
  const authStatus = useAppStore((s) => s.authStatus)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const startAuthFlow = useAppStore((s) => s.startAuthFlow)
  const toggleSettings = useAppStore((s) => s.toggleSettings)
  const restartApp = useAppStore((s) => s.restartApp)
  const [pinInput, setPinInput] = useState('')
  const [unlocked, setUnlocked] = useState(false)

  if (!settings) return null

  // PIN gate
  if (settings.pin && !unlocked) {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center">
        <div className="bg-dash-surface rounded-2xl p-8 w-80">
          <h2 className="text-dash-text font-semibold text-center mb-4" style={{ fontSize: '24px' }}>
            Enter PIN
          </h2>
          <input
            type="password"
            maxLength={4}
            value={pinInput}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '')
              setPinInput(val)
              if (val.length === 4) {
                if (val === settings.pin) {
                  setUnlocked(true)
                } else {
                  setPinInput('')
                }
              }
            }}
            className="w-full bg-dash-bg border border-dash-border rounded-lg px-4 py-3 text-dash-text text-center tracking-widest outline-none focus:border-dash-accent"
            style={{ fontSize: '32px', cursor: 'auto', letterSpacing: '0.5em' }}
            autoFocus
          />
          <button
            className="mt-4 w-full py-2 rounded-lg bg-dash-border text-dash-text-secondary"
            style={{ fontSize: '16px' }}
            onPointerDown={toggleSettings}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  const update = (path: string, value: string | number | boolean): void => {
    const parts = path.split('.')
    if (parts.length === 2) {
      const section = parts[0] as keyof AppSettings
      const key = parts[1] as string
      const current = settings[section]
      if (typeof current === 'object' && current !== null) {
        void updateSettings({
          [section]: { ...current, [key]: value }
        } as Partial<AppSettings>)
      }
    } else {
      void updateSettings({ [path]: value } as Partial<AppSettings>)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-90 overflow-y-auto">
      <div className="max-w-2xl mx-auto py-8 px-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-dash-text font-bold" style={{ fontSize: '32px' }}>Settings</h1>
          <button
            className="w-12 h-12 rounded-full bg-dash-surface flex items-center justify-center text-dash-text"
            style={{ fontSize: '24px' }}
            onPointerDown={toggleSettings}
          >
            X
          </button>
        </div>

        {/* Google Calendar */}
        <section className="bg-dash-surface rounded-2xl p-6 mb-4">
          <h2 className="text-dash-text font-semibold mb-4" style={{ fontSize: '22px' }}>
            Google Calendar
          </h2>
          {authStatus.isAuthenticated ? (
            <div>
              <p className="text-green-400 mb-2" style={{ fontSize: '16px' }}>
                Connected as {authStatus.email ?? 'unknown'}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-dash-text-secondary mb-3" style={{ fontSize: '16px' }}>
                {authStatus.error ?? 'Not connected'}
              </p>
              <Field
                label="Client ID"
                value={settings.googleClientId}
                onChange={(v) => update('googleClientId', v)}
              />
              <div className="mt-2">
                <Field
                  label="Client Secret"
                  value={settings.googleClientSecret}
                  onChange={(v) => update('googleClientSecret', v)}
                  type="password"
                />
              </div>
              <button
                className="mt-3 px-4 py-2 rounded-lg bg-dash-accent text-white font-medium"
                style={{ fontSize: '16px' }}
                onPointerDown={() => void startAuthFlow()}
                disabled={!settings.googleClientId || !settings.googleClientSecret}
              >
                Connect Google Calendar
              </button>
            </div>
          )}
        </section>

        {/* NAS Configuration */}
        <section className="bg-dash-surface rounded-2xl p-6 mb-4">
          <h2 className="text-dash-text font-semibold mb-4" style={{ fontSize: '22px' }}>
            NAS (Photo Source)
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Host/IP" value={settings.nas.host} onChange={(v) => update('nas.host', v)} />
            <Field label="Share Name" value={settings.nas.share} onChange={(v) => update('nas.share', v)} />
            <Field label="Username" value={settings.nas.username} onChange={(v) => update('nas.username', v)} />
            <Field label="Password" value={settings.nas.password} onChange={(v) => update('nas.password', v)} type="password" />
          </div>
        </section>

        {/* Weather */}
        <section className="bg-dash-surface rounded-2xl p-6 mb-4">
          <h2 className="text-dash-text font-semibold mb-4" style={{ fontSize: '22px' }}>
            Weather
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude" value={settings.weather.latitude} onChange={(v) => update('weather.latitude', parseFloat(v) || 0)} type="number" />
            <Field label="Longitude" value={settings.weather.longitude} onChange={(v) => update('weather.longitude', parseFloat(v) || 0)} type="number" />
          </div>
          <div className="mt-3">
            <Toggle
              label="Use Fahrenheit"
              checked={settings.weather.units === 'fahrenheit'}
              onChange={(checked) => update('weather.units', checked ? 'fahrenheit' : 'celsius')}
            />
          </div>
        </section>

        {/* Slideshow */}
        <section className="bg-dash-surface rounded-2xl p-6 mb-4">
          <h2 className="text-dash-text font-semibold mb-4" style={{ fontSize: '22px' }}>
            Slideshow
          </h2>
          <Field
            label="Interval (seconds)"
            value={settings.slideshow.intervalSeconds}
            onChange={(v) => update('slideshow.intervalSeconds', parseInt(v) || 15)}
            type="number"
          />
          <div className="mt-3">
            <Toggle label="Shuffle Photos" checked={settings.slideshow.shuffled} onChange={(v) => update('slideshow.shuffled', v)} />
          </div>
        </section>

        {/* Night Mode */}
        <section className="bg-dash-surface rounded-2xl p-6 mb-4">
          <h2 className="text-dash-text font-semibold mb-4" style={{ fontSize: '22px' }}>
            Night Mode
          </h2>
          <Toggle label="Enabled" checked={settings.nightMode.enabled} onChange={(v) => update('nightMode.enabled', v)} />
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Field label="Dim Start" value={settings.nightMode.dimStart} onChange={(v) => update('nightMode.dimStart', v)} />
            <Field label="Dim End" value={settings.nightMode.dimEnd} onChange={(v) => update('nightMode.dimEnd', v)} />
          </div>
          <div className="mt-3">
            <Toggle label="Clock Only Mode" checked={settings.nightMode.clockOnlyMode} onChange={(v) => update('nightMode.clockOnlyMode', v)} />
          </div>
        </section>

        {/* App Control */}
        <section className="bg-dash-surface rounded-2xl p-6 mb-4">
          <h2 className="text-dash-text font-semibold mb-4" style={{ fontSize: '22px' }}>
            App Control
          </h2>
          <button
            className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium"
            style={{ fontSize: '16px' }}
            onPointerDown={() => void restartApp()}
          >
            Restart App
          </button>
        </section>
      </div>
    </div>
  )
}
