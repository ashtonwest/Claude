import React, { useState } from 'react'
import { useAppStore } from '../stores/appStore'
import type { AppSettings, WeatherLocation } from '@shared/types'

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
      style={{ cursor: 'pointer' }}
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

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export const SettingsPanel: React.FC = () => {
  const settings = useAppStore((s) => s.settings)
  const authStatus = useAppStore((s) => s.authStatus)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const startAuthFlow = useAppStore((s) => s.startAuthFlow)
  const addAccount = useAppStore((s) => s.addAccount)
  const removeAccount = useAppStore((s) => s.removeAccount)
  const toggleSettings = useAppStore((s) => s.toggleSettings)
  const restartApp = useAppStore((s) => s.restartApp)
  const [pinInput, setPinInput] = useState('')
  const [unlocked, setUnlocked] = useState(false)

  // New location form
  const [newLocName, setNewLocName] = useState('')
  const [newLocLat, setNewLocLat] = useState('')
  const [newLocLng, setNewLocLng] = useState('')

  // (calendar sources removed — now uses multi-account)

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
            style={{ fontSize: '16px', cursor: 'pointer' }}
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

  // --- Weather location helpers ---
  const addLocation = (): void => {
    if (!newLocName || !newLocLat || !newLocLng) return
    const loc: WeatherLocation = {
      id: generateId(),
      name: newLocName,
      latitude: parseFloat(newLocLat),
      longitude: parseFloat(newLocLng)
    }
    const updated = [...settings.weather.locations, loc]
    void updateSettings({
      weather: {
        ...settings.weather,
        locations: updated,
        activeLocationId: settings.weather.activeLocationId || loc.id
      }
    })
    setNewLocName('')
    setNewLocLat('')
    setNewLocLng('')
  }

  const removeLocation = (id: string): void => {
    const updated = settings.weather.locations.filter((l) => l.id !== id)
    const activeId = settings.weather.activeLocationId === id
      ? (updated[0]?.id ?? '')
      : settings.weather.activeLocationId
    void updateSettings({
      weather: { ...settings.weather, locations: updated, activeLocationId: activeId }
    })
  }

  const setActiveLocation = (id: string): void => {
    void updateSettings({
      weather: { ...settings.weather, activeLocationId: id }
    })
  }


  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-90 overflow-y-auto">
      <div className="max-w-2xl mx-auto py-8 px-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-dash-text font-bold" style={{ fontSize: '32px' }}>Settings</h1>
          <button
            className="w-12 h-12 rounded-full bg-dash-surface flex items-center justify-center text-dash-text"
            style={{ fontSize: '24px', cursor: 'pointer' }}
            onPointerDown={toggleSettings}
          >
            X
          </button>
        </div>

        {/* Google Accounts */}
        <section className="bg-dash-surface rounded-2xl p-6 mb-4">
          <h2 className="text-dash-text font-semibold mb-4" style={{ fontSize: '22px' }}>
            Google Accounts
          </h2>

          {/* OAuth credentials */}
          {(!settings.googleClientId || !settings.googleClientSecret) && (
            <div className="mb-4">
              <p className="text-dash-text-secondary mb-3" style={{ fontSize: '14px' }}>
                First, enter your Google OAuth credentials (from Google Cloud Console).
              </p>
              <div className="grid grid-cols-1 gap-2">
                <Field label="Client ID" value={settings.googleClientId} onChange={(v) => update('googleClientId', v)} />
                <Field label="Client Secret" value={settings.googleClientSecret} onChange={(v) => update('googleClientSecret', v)} type="password" />
              </div>
            </div>
          )}

          {/* Connected accounts */}
          <div className="flex flex-col gap-2 mb-4">
            {authStatus.accounts.map((account) => (
              <div key={account.id} className="flex items-center gap-3 bg-dash-bg bg-opacity-50 rounded-lg px-3 py-2">
                <div className="w-8 h-8 rounded-full bg-dash-accent flex items-center justify-center text-white font-bold" style={{ fontSize: '14px' }}>
                  {account.email.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-dash-text font-medium truncate" style={{ fontSize: '16px' }}>{account.email}</p>
                </div>
                <button
                  className="text-red-400 hover:text-red-300 px-3 py-1 rounded bg-dash-bg"
                  style={{ cursor: 'pointer', fontSize: '13px' }}
                  onClick={() => void removeAccount(account.id)}
                >
                  Remove
                </button>
              </div>
            ))}

            {authStatus.accounts.length === 0 && settings.googleClientId && (
              <p className="text-dash-text-secondary" style={{ fontSize: '14px' }}>
                No accounts connected yet.
              </p>
            )}
          </div>

          {/* Add account button */}
          {settings.googleClientId && settings.googleClientSecret && (
            <button
              className="px-4 py-2 rounded-lg bg-dash-accent text-white font-medium"
              style={{ fontSize: '16px', cursor: 'pointer' }}
              onClick={() => void addAccount()}
            >
              + Add Google Account
            </button>
          )}
        </section>

        {/* Weather Locations */}
        <section className="bg-dash-surface rounded-2xl p-6 mb-4">
          <h2 className="text-dash-text font-semibold mb-4" style={{ fontSize: '22px' }}>
            Weather Locations
          </h2>
          <p className="text-dash-text-secondary mb-3" style={{ fontSize: '14px' }}>
            Add locations and tap one to set it as active. Find coordinates by right-clicking in Google Maps.
          </p>

          {/* Existing locations */}
          <div className="flex flex-col gap-2 mb-4">
            {settings.weather.locations.map((loc) => {
              const isActive = loc.id === settings.weather.activeLocationId
              return (
                <div
                  key={loc.id}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                    isActive ? 'bg-dash-accent bg-opacity-20 border border-dash-accent' : 'bg-dash-bg bg-opacity-50'
                  }`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setActiveLocation(loc.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-dash-text font-medium" style={{ fontSize: '16px' }}>
                      {loc.name}
                      {isActive && (
                        <span className="text-dash-accent ml-2" style={{ fontSize: '12px' }}>ACTIVE</span>
                      )}
                    </p>
                    <p className="text-dash-text-secondary" style={{ fontSize: '12px' }}>
                      {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                    </p>
                  </div>
                  <button
                    className="text-red-400 hover:text-red-300 px-2"
                    style={{ cursor: 'pointer', fontSize: '18px' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      removeLocation(loc.id)
                    }}
                  >
                    x
                  </button>
                </div>
              )
            })}

            {settings.weather.locations.length === 0 && (
              <p className="text-dash-text-secondary" style={{ fontSize: '14px' }}>
                No locations saved. Add one below.
              </p>
            )}
          </div>

          {/* Add new location */}
          <div className="border border-dash-border rounded-lg p-3">
            <p className="text-dash-text-secondary mb-2" style={{ fontSize: '14px' }}>Add Location</p>
            <div className="grid grid-cols-3 gap-2">
              <input
                placeholder="Name (e.g. Home)"
                value={newLocName}
                onChange={(e) => setNewLocName(e.target.value)}
                className="bg-dash-bg border border-dash-border rounded-lg px-3 py-2 text-dash-text outline-none focus:border-dash-accent"
                style={{ fontSize: '14px', cursor: 'auto' }}
              />
              <input
                placeholder="Latitude"
                value={newLocLat}
                onChange={(e) => setNewLocLat(e.target.value)}
                className="bg-dash-bg border border-dash-border rounded-lg px-3 py-2 text-dash-text outline-none focus:border-dash-accent"
                style={{ fontSize: '14px', cursor: 'auto' }}
                type="number"
                step="any"
              />
              <input
                placeholder="Longitude"
                value={newLocLng}
                onChange={(e) => setNewLocLng(e.target.value)}
                className="bg-dash-bg border border-dash-border rounded-lg px-3 py-2 text-dash-text outline-none focus:border-dash-accent"
                style={{ fontSize: '14px', cursor: 'auto' }}
                type="number"
                step="any"
              />
            </div>
            <button
              className="mt-2 px-4 py-2 rounded-lg bg-dash-accent text-white font-medium disabled:opacity-50"
              style={{ fontSize: '14px', cursor: 'pointer' }}
              onClick={addLocation}
              disabled={!newLocName || !newLocLat || !newLocLng}
            >
              Add Location
            </button>
          </div>

          {/* Units toggle */}
          <div className="mt-4">
            <Toggle
              label="Use Fahrenheit"
              checked={settings.weather.units === 'fahrenheit'}
              onChange={(checked) => {
                void updateSettings({
                  weather: { ...settings.weather, units: checked ? 'fahrenheit' : 'celsius' }
                })
              }}
            />
          </div>
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
            style={{ fontSize: '16px', cursor: 'pointer' }}
            onPointerDown={() => void restartApp()}
          >
            Restart App
          </button>
        </section>
      </div>
    </div>
  )
}
