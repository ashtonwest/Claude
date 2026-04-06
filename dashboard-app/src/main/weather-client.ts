import fs from 'fs'
import path from 'path'
import axios from 'axios'
import configWatcher from './config-watcher'
import logger from './logger'
import type { WeatherData, WeatherDaily, WeatherHourly } from '@shared/types'

let cachedWeather: WeatherData | null = null
let pollInterval: ReturnType<typeof setInterval> | null = null
let lastLocationKey = ''

function getCachePath(): string {
  return path.join(process.cwd(), 'cache', 'weather-cache.json')
}

function loadCache(): WeatherData | null {
  try {
    const cachePath = getCachePath()
    if (fs.existsSync(cachePath)) {
      const raw = fs.readFileSync(cachePath, 'utf-8')
      cachedWeather = JSON.parse(raw) as WeatherData
      logger.info('Weather cache loaded', { fetchedAt: new Date(cachedWeather.fetchedAt).toISOString() })
      return cachedWeather
    }
  } catch (err) {
    logger.error('Failed to load weather cache', { error: String(err) })
  }
  return null
}

function saveCache(data: WeatherData): void {
  try {
    const cachePath = getCachePath()
    const dir = path.dirname(cachePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(cachePath, JSON.stringify(data), 'utf-8')
  } catch (err) {
    logger.error('Failed to save weather cache', { error: String(err) })
  }
}

function isCacheFresh(): boolean {
  if (!cachedWeather) return false
  const config = configWatcher.getConfig()
  const maxAgeMs = config.weather.refreshIntervalMinutes * 60 * 1000
  return Date.now() - cachedWeather.fetchedAt < maxAgeMs
}

function getLocationKey(config: ReturnType<typeof configWatcher.getConfig>): string {
  const loc = getActiveLocation(config)
  if (!loc) return ''
  return `${loc.latitude},${loc.longitude}`
}

interface OpenMeteoResponse {
  current: {
    temperature_2m: number
    apparent_temperature: number
    weather_code: number
    wind_speed_10m: number
    relative_humidity_2m: number
    is_day: number
  }
  daily: {
    time: string[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    weather_code: number[]
    precipitation_probability_max: number[]
  }
  hourly: {
    time: string[]
    temperature_2m: number[]
    weather_code: number[]
    precipitation_probability: number[]
    relative_humidity_2m: number[]
    wind_speed_10m: number[]
  }
}

function getActiveLocation(config: ReturnType<typeof configWatcher.getConfig>): { latitude: number; longitude: number } | null {
  const { locations, activeLocationId } = config.weather
  if (locations.length === 0) return null
  const active = locations.find((l) => l.id === activeLocationId) ?? locations[0]
  if (!active || (active.latitude === 0 && active.longitude === 0)) return null
  return { latitude: active.latitude, longitude: active.longitude }
}

export async function fetchWeather(): Promise<WeatherData | null> {
  const config = configWatcher.getConfig()
  const location = getActiveLocation(config)

  if (!location) {
    logger.info('Weather: no location configured')
    return cachedWeather
  }

  // Check if cache is fresh and for the same location
  const locationKey = getLocationKey(config)
  if (isCacheFresh() && locationKey === lastLocationKey) {
    return cachedWeather
  }

  const tempUnit = config.weather.units === 'fahrenheit' ? 'fahrenheit' : 'celsius'
  const url =
    `https://api.open-meteo.com/v1/forecast?` +
    `latitude=${location.latitude}&` +
    `longitude=${location.longitude}&` +
    `current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,apparent_temperature,is_day&` +
    `daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&` +
    `hourly=temperature_2m,weather_code,precipitation_probability,relative_humidity_2m,wind_speed_10m&` +
    `temperature_unit=${tempUnit}&` +
    `forecast_days=16&` +
    `timezone=auto`

  try {
    const response = await axios.get<OpenMeteoResponse>(url, { timeout: 10_000 })
    const data = response.data

    const daily: WeatherDaily[] = (data.daily.time || []).map((date, i) => ({
      date,
      maxTemp: data.daily.temperature_2m_max[i] || 0,
      minTemp: data.daily.temperature_2m_min[i] || 0,
      weatherCode: data.daily.weather_code[i] || 0,
      precipitationProbability: data.daily.precipitation_probability_max[i] || 0
    }))

    const hourly: WeatherHourly[] = (data.hourly.time || []).map((time, i) => ({
      time,
      temperature: data.hourly.temperature_2m[i] || 0,
      weatherCode: data.hourly.weather_code[i] || 0,
      precipitationProbability: data.hourly.precipitation_probability[i] || 0,
      humidity: data.hourly.relative_humidity_2m[i] || 0,
      windSpeed: data.hourly.wind_speed_10m[i] || 0
    }))

    const weather: WeatherData = {
      current: {
        temperature: data.current.temperature_2m,
        apparentTemperature: data.current.apparent_temperature,
        weatherCode: data.current.weather_code,
        windSpeed: data.current.wind_speed_10m,
        humidity: data.current.relative_humidity_2m,
        isDay: data.current.is_day === 1
      },
      daily,
      hourly,
      fetchedAt: Date.now(),
      units: config.weather.units
    }

    cachedWeather = weather
    lastLocationKey = locationKey
    saveCache(weather)
    logger.info('Weather data fetched and cached', { hourlyCount: hourly.length, dailyCount: daily.length })
    return weather
  } catch (err) {
    logger.error('Weather fetch failed, using cache', { error: String(err) })
    if (!cachedWeather) {
      loadCache()
    }
    return cachedWeather
  }
}

export function getData(): WeatherData | null {
  if (!cachedWeather) {
    loadCache()
  }
  return cachedWeather
}

export function startPolling(): void {
  if (pollInterval) clearInterval(pollInterval)

  // Load cache first — instant data on startup
  loadCache()

  const config = configWatcher.getConfig()
  const intervalMs = config.weather.refreshIntervalMinutes * 60 * 1000

  pollInterval = setInterval(() => {
    void fetchWeather()
  }, intervalMs)

  // Only fetch if cache is stale
  if (!isCacheFresh()) {
    void fetchWeather()
  } else {
    logger.info('Weather: using cached data, next fetch in', { minutes: config.weather.refreshIntervalMinutes })
  }

  logger.info('Weather polling started', { intervalMinutes: config.weather.refreshIntervalMinutes })
}

export function stopPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}
