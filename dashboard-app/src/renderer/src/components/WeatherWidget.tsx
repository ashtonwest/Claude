import React, { useEffect } from 'react'
import { useWeatherStore } from '../stores/weatherStore'
import { WMO_WEATHER_CODES } from '@shared/types'

function getWeatherIcon(code: number): string {
  return WMO_WEATHER_CODES[code]?.icon ?? '🌡️'
}

function getWeatherDescription(code: number): string {
  return WMO_WEATHER_CODES[code]?.description ?? 'Unknown'
}

export const WeatherWidget: React.FC = () => {
  const weather = useWeatherStore((s) => s.weather)
  const fetchWeather = useWeatherStore((s) => s.fetchWeather)

  useEffect(() => {
    void fetchWeather()
    const interval = setInterval(() => void fetchWeather(), 15 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchWeather])

  if (!weather) {
    return (
      <div className="flex items-center gap-3 bg-dash-surface bg-opacity-80 rounded-2xl px-6 py-4">
        <span className="text-dash-text-secondary" style={{ fontSize: '28px' }}>
          Weather unavailable
        </span>
      </div>
    )
  }

  const { current, daily, units } = weather
  const unitSymbol = units === 'fahrenheit' ? 'F' : 'C'

  return (
    <div className="flex flex-col items-end gap-2 bg-dash-surface bg-opacity-80 rounded-2xl px-6 py-4">
      <div className="flex items-center gap-4">
        <span style={{ fontSize: '48px' }}>{getWeatherIcon(current.weatherCode)}</span>
        <div className="flex flex-col items-end">
          <span className="text-dash-text font-bold leading-none" style={{ fontSize: '64px' }}>
            {Math.round(current.temperature)}&deg;
          </span>
          <span className="text-dash-text-secondary" style={{ fontSize: '20px' }}>
            Feels like {Math.round(current.apparentTemperature)}&deg;{unitSymbol}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-dash-text-secondary" style={{ fontSize: '16px' }}>
        <span>{getWeatherDescription(current.weatherCode)}</span>
        <span>💧 {current.humidity}%</span>
        <span>💨 {Math.round(current.windSpeed)} km/h</span>
      </div>

      <div className="flex gap-4 mt-1">
        {daily.slice(1, 4).map((day) => (
          <div
            key={day.date}
            className="flex flex-col items-center gap-1 bg-dash-bg bg-opacity-50 rounded-xl px-3 py-2"
          >
            <span className="text-dash-text-secondary" style={{ fontSize: '14px' }}>
              {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
            </span>
            <span style={{ fontSize: '24px' }}>{getWeatherIcon(day.weatherCode)}</span>
            <div className="flex gap-2" style={{ fontSize: '16px' }}>
              <span className="text-dash-text font-semibold">{Math.round(day.maxTemp)}&deg;</span>
              <span className="text-dash-text-secondary">{Math.round(day.minTemp)}&deg;</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
