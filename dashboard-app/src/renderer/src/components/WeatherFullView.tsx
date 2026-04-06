import React, { useEffect, useState, useMemo } from 'react'
import { useWeatherStore } from '../stores/weatherStore'
import { useAppStore } from '../stores/appStore'
import { WMO_WEATHER_CODES } from '@shared/types'
import type { WeatherHourly } from '@shared/types'

function getWeatherIcon(code: number): string {
  return WMO_WEATHER_CODES[code]?.icon ?? '🌡️'
}

function getWeatherDescription(code: number): string {
  return WMO_WEATHER_CODES[code]?.description ?? 'Unknown'
}

export const WeatherFullView: React.FC = () => {
  const weather = useWeatherStore((s) => s.weather)
  const fetchWeather = useWeatherStore((s) => s.fetchWeather)
  const settings = useAppStore((s) => s.settings)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  useEffect(() => {
    void fetchWeather()
  }, [fetchWeather])

  const activeLocationName = useMemo(() => {
    if (!settings) return ''
    const loc = settings.weather.locations.find((l) => l.id === settings.weather.activeLocationId)
    return loc?.name ?? settings.weather.locations[0]?.name ?? ''
  }, [settings])

  // Get hourly data for the selected day
  const selectedHourly = useMemo((): WeatherHourly[] => {
    if (!selectedDay || !weather?.hourly) return []
    return weather.hourly.filter((h) => h.time.startsWith(selectedDay))
  }, [selectedDay, weather?.hourly])

  const selectedDayInfo = useMemo(() => {
    if (!selectedDay || !weather?.daily) return null
    return weather.daily.find((d) => d.date === selectedDay) ?? null
  }, [selectedDay, weather?.daily])

  // Cache age display
  const cacheAge = useMemo(() => {
    if (!weather?.fetchedAt) return ''
    const mins = Math.round((Date.now() - weather.fetchedAt) / 60_000)
    if (mins < 1) return 'just now'
    if (mins === 1) return '1 min ago'
    if (mins < 60) return `${mins} min ago`
    const hrs = Math.round(mins / 60)
    return `${hrs}h ago`
  }, [weather?.fetchedAt])

  if (!weather) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#161b22', borderRadius: '16px' }}>
        <p style={{ fontSize: '22px', color: '#8b949e' }}>Add a weather location in Settings (F2)</p>
      </div>
    )
  }

  const { current, daily, units } = weather
  const unitSymbol = units === 'fahrenheit' ? 'F' : 'C'

  // Hourly detail view for a selected day
  if (selectedDay && selectedDayInfo) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#161b22', borderRadius: '16px', padding: '24px', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: '28px', fontWeight: 600, color: '#e6edf3', margin: 0 }}>
              {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
              <span style={{ fontSize: '36px' }}>{getWeatherIcon(selectedDayInfo.weatherCode)}</span>
              <span style={{ fontSize: '32px', fontWeight: 700, color: '#e6edf3' }}>
                {Math.round(selectedDayInfo.maxTemp)}&deg; / {Math.round(selectedDayInfo.minTemp)}&deg;{unitSymbol}
              </span>
              <span style={{ fontSize: '18px', color: '#8b949e' }}>
                {getWeatherDescription(selectedDayInfo.weatherCode)} — 💧 {selectedDayInfo.precipitationProbability}% rain
              </span>
            </div>
          </div>
          <button
            onClick={() => setSelectedDay(null)}
            style={{ fontSize: '16px', color: '#8b949e', cursor: 'pointer', background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '8px 16px' }}
          >
            Back to forecast
          </button>
        </div>

        {/* Hourly breakdown */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px' }}>
            {selectedHourly.map((hour) => {
              const time = new Date(hour.time)
              const hourStr = time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
              const isNow = Math.abs(Date.now() - time.getTime()) < 30 * 60_000

              return (
                <div
                  key={hour.time}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '12px 8px',
                    borderRadius: '12px',
                    backgroundColor: isNow ? 'rgba(31, 111, 235, 0.2)' : 'rgba(13, 17, 23, 0.5)',
                    border: isNow ? '1px solid #1f6feb' : '1px solid transparent'
                  }}
                >
                  <span style={{ fontSize: '13px', color: isNow ? '#1f6feb' : '#8b949e', fontWeight: isNow ? 600 : 400 }}>
                    {isNow ? 'Now' : hourStr}
                  </span>
                  <span style={{ fontSize: '24px' }}>{getWeatherIcon(hour.weatherCode)}</span>
                  <span style={{ fontSize: '18px', fontWeight: 600, color: '#e6edf3' }}>
                    {Math.round(hour.temperature)}&deg;
                  </span>
                  <span style={{ fontSize: '12px', color: '#8b949e' }}>💧 {hour.precipitationProbability}%</span>
                  <span style={{ fontSize: '12px', color: '#8b949e' }}>💨 {Math.round(hour.windSpeed)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Main forecast view
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#161b22', borderRadius: '16px', padding: '24px', overflow: 'hidden' }}>
      {/* Current conditions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexShrink: 0 }}>
        <span style={{ fontSize: '80px' }}>{getWeatherIcon(current.weatherCode)}</span>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            <span style={{ fontSize: '96px', fontWeight: 'bold', color: '#e6edf3', lineHeight: 1 }}>
              {Math.round(current.temperature)}&deg;
            </span>
            <span style={{ fontSize: '28px', color: '#8b949e' }}>{unitSymbol}</span>
          </div>
          <p style={{ fontSize: '24px', color: '#8b949e', marginTop: '4px' }}>
            Feels like {Math.round(current.apparentTemperature)}&deg;{unitSymbol}
          </p>
          {activeLocationName && (
            <p style={{ fontSize: '20px', color: '#e6edf3', marginTop: '4px', fontWeight: 500 }}>
              {activeLocationName}
            </p>
          )}
        </div>
      </div>

      {/* Condition details + cache info */}
      <div style={{ display: 'flex', gap: '32px', fontSize: '20px', color: '#8b949e', flexShrink: 0 }}>
        <span>{getWeatherDescription(current.weatherCode)}</span>
        <span>💧 Humidity {current.humidity}%</span>
        <span>💨 Wind {Math.round(current.windSpeed)} km/h</span>
        {cacheAge && <span style={{ fontSize: '14px', opacity: 0.6 }}>Updated {cacheAge}</span>}
      </div>

      {/* Forecast grid — click a day for hourly breakdown */}
      <p style={{ fontSize: '14px', color: '#8b949e', margin: 0, flexShrink: 0 }}>
        Tap a day for hourly breakdown
      </p>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${Math.min(daily.length, 8)}, 1fr)`, gap: '8px', minHeight: 0, overflowY: 'auto' }}>
        {daily.map((day, i) => {
          const isToday = i === 0
          return (
            <div
              key={day.date}
              onClick={() => setSelectedDay(day.date)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 4px',
                borderRadius: '12px',
                backgroundColor: isToday ? 'rgba(31, 111, 235, 0.2)' : 'rgba(13, 17, 23, 0.5)',
                border: isToday ? '1px solid #1f6feb' : '1px solid transparent',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => { if (!isToday) e.currentTarget.style.backgroundColor = 'rgba(48, 54, 61, 0.8)' }}
              onMouseLeave={(e) => { if (!isToday) e.currentTarget.style.backgroundColor = 'rgba(13, 17, 23, 0.5)' }}
            >
              <span style={{ fontSize: '14px', color: isToday ? '#1f6feb' : '#8b949e', fontWeight: isToday ? 600 : 400 }}>
                {isToday ? 'Today' : new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
              </span>
              <span style={{ fontSize: '13px', color: '#8b949e' }}>
                {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <span style={{ fontSize: '28px' }}>{getWeatherIcon(day.weatherCode)}</span>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '18px', fontWeight: 600, color: '#e6edf3' }}>{Math.round(day.maxTemp)}&deg;</span>
                <span style={{ fontSize: '16px', color: '#8b949e', marginLeft: '4px' }}>{Math.round(day.minTemp)}&deg;</span>
              </div>
              <span style={{ fontSize: '13px', color: '#8b949e' }}>💧 {day.precipitationProbability}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
