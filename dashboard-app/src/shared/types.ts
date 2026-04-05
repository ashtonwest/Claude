export interface CalendarEvent {
  id: string
  summary: string
  description: string
  location: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  colorId: string
  calendarId: string
}

export interface WeatherCurrent {
  temperature: number
  apparentTemperature: number
  weatherCode: number
  windSpeed: number
  humidity: number
  isDay: boolean
}

export interface WeatherDaily {
  date: string
  maxTemp: number
  minTemp: number
  weatherCode: number
  precipitationProbability: number
}

export interface WeatherData {
  current: WeatherCurrent
  daily: WeatherDaily[]
  fetchedAt: number
  units: 'fahrenheit' | 'celsius'
}

export interface PhotoMeta {
  id: string
  originalPath: string
  cachePath: string
  width: number
  height: number
  filename: string
}

export interface GoogleAccount {
  id: string
  email: string
  name: string
  color: string
  enabled: boolean
}

export interface AuthStatus {
  isAuthenticated: boolean
  email?: string
  expiresAt?: number
  error?: string
  accounts: GoogleAccount[]
}

export type CalendarView = 'day' | 'week' | 'month' | 'year'

export interface OnlineStatus {
  nas: boolean
  calendar: boolean
  weather: boolean
}

export interface NasConfig {
  host: string
  share: string
  username: string
  password: string
  folders: string[]
  domain: string
}

export interface CalendarSource {
  id: string
  name: string
  calendarId: string
  color: string
  enabled: boolean
}

export interface CalendarConfig {
  provider: string
  refreshIntervalMinutes: number
  lookaheadDays: number
  maxEventsPerDay: number
  sources: CalendarSource[]
}

export interface SlideshowConfig {
  intervalSeconds: number
  transitionMs: number
  shuffled: boolean
  videoEnabled: boolean
  supportedExtensions: string[]
  maxCachedImages: number
}

export interface WeatherLocation {
  id: string
  name: string
  latitude: number
  longitude: number
}

export interface WeatherConfig {
  locations: WeatherLocation[]
  activeLocationId: string
  units: 'fahrenheit' | 'celsius'
  refreshIntervalMinutes: number
}

export interface NightModeConfig {
  enabled: boolean
  dimStart: string
  dimEnd: string
  dimOpacity: number
  clockOnlyMode: boolean
}

export interface DisplayConfig {
  showClock: boolean
  showWeather: boolean
  showCalendar: boolean
  showSlideshow: boolean
  cursorHidden: boolean
}

export interface BurnInConfig {
  enabled: boolean
  panZoomEnabled: boolean
  uiDriftIntervalMinutes: number
  uiDriftPx: number
}

export interface AppSettings {
  nas: NasConfig
  calendar: CalendarConfig
  slideshow: SlideshowConfig
  weather: WeatherConfig
  nightMode: NightModeConfig
  display: DisplayConfig
  burnInPrevention: BurnInConfig
  pin: string
  googleClientId: string
  googleClientSecret: string
}

export const GOOGLE_CALENDAR_COLOR_MAP: Record<string, string> = {
  '1': '#7986cb',
  '2': '#33b679',
  '3': '#8e24aa',
  '4': '#e67c73',
  '5': '#f6bf26',
  '6': '#f4511e',
  '7': '#039be5',
  '8': '#616161',
  '9': '#3f51b5',
  '10': '#0b8043',
  '11': '#d50000'
}

export const WMO_WEATHER_CODES: Record<number, { icon: string; description: string }> = {
  0: { icon: '☀️', description: 'Clear sky' },
  1: { icon: '🌤️', description: 'Mainly clear' },
  2: { icon: '⛅', description: 'Partly cloudy' },
  3: { icon: '☁️', description: 'Overcast' },
  45: { icon: '🌫️', description: 'Fog' },
  48: { icon: '🌫️', description: 'Rime fog' },
  51: { icon: '🌦️', description: 'Light drizzle' },
  53: { icon: '🌦️', description: 'Moderate drizzle' },
  55: { icon: '🌧️', description: 'Dense drizzle' },
  56: { icon: '🌨️', description: 'Freezing drizzle' },
  57: { icon: '🌨️', description: 'Heavy freezing drizzle' },
  61: { icon: '🌧️', description: 'Slight rain' },
  63: { icon: '🌧️', description: 'Moderate rain' },
  65: { icon: '🌧️', description: 'Heavy rain' },
  66: { icon: '🌨️', description: 'Light freezing rain' },
  67: { icon: '🌨️', description: 'Heavy freezing rain' },
  71: { icon: '❄️', description: 'Slight snow' },
  73: { icon: '❄️', description: 'Moderate snow' },
  75: { icon: '❄️', description: 'Heavy snow' },
  77: { icon: '🌨️', description: 'Snow grains' },
  80: { icon: '🌦️', description: 'Slight showers' },
  81: { icon: '🌧️', description: 'Moderate showers' },
  82: { icon: '🌧️', description: 'Violent showers' },
  85: { icon: '🌨️', description: 'Slight snow showers' },
  86: { icon: '🌨️', description: 'Heavy snow showers' },
  95: { icon: '⛈️', description: 'Thunderstorm' },
  96: { icon: '⛈️', description: 'Thunderstorm with hail' },
  99: { icon: '⛈️', description: 'Thunderstorm with heavy hail' }
}
