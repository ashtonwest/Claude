import React, { useEffect } from 'react'
import { useWeatherStore } from '../stores/weatherStore'
import { useAppStore } from '../stores/appStore'
import { WMO_WEATHER_CODES } from '@shared/types'

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

  useEffect(() => {
    void fetchWeather()
  }, [fetchWeather])

  const activeLocationName = (() => {
    if (!settings) return ''
    const loc = settings.weather.locations.find((l) => l.id === settings.weather.activeLocationId)
    return loc?.name ?? settings.weather.locations[0]?.name ?? ''
  })()

  if (!weather) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#161b22', borderRadius: '16px' }}>
        <p style={{ fontSize: '22px', color: '#8b949e' }}>Add a weather location in Settings (F2)</p>
      </div>
    )
  }

  const { current, daily, units } = weather
  const unitSymbol = units === 'fahrenheit' ? 'F' : 'C'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#161b22', borderRadius: '16px', padding: '24px', overflow: 'hidden' }}>
      {/* Current conditions — large */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
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

      {/* Condition details */}
      <div style={{ display: 'flex', gap: '32px', fontSize: '20px', color: '#8b949e' }}>
        <span>{getWeatherDescription(current.weatherCode)}</span>
        <span>💧 Humidity {current.humidity}%</span>
        <span>💨 Wind {Math.round(current.windSpeed)} km/h</span>
      </div>

      {/* Forecast grid */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${Math.min(daily.length, 15)}, 1fr)`, gap: '8px', minHeight: 0 }}>
        {daily.slice(0, 15).map((day, i) => {
          const isToday = i === 0
          return (
            <div
              key={day.date}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 4px',
                borderRadius: '12px',
                backgroundColor: isToday ? 'rgba(31, 111, 235, 0.2)' : 'rgba(13, 17, 23, 0.5)',
                border: isToday ? '1px solid #1f6feb' : '1px solid transparent'
              }}
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
