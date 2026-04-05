import fs from 'fs'
import path from 'path'
import { google } from 'googleapis'
import { getOAuth2Client, getAccessToken, getAuthStatus } from './google-auth'
import configWatcher from './config-watcher'
import logger from './logger'
import type { CalendarEvent } from '@shared/types'

let cachedEvents: CalendarEvent[] = []
let lastFetched = 0
let pollInterval: ReturnType<typeof setInterval> | null = null

function getCachePath(): string {
  return path.join(process.cwd(), 'cache', 'calendar-cache.json')
}

function loadCache(): CalendarEvent[] {
  try {
    const cachePath = getCachePath()
    if (fs.existsSync(cachePath)) {
      const raw = fs.readFileSync(cachePath, 'utf-8')
      const data = JSON.parse(raw) as { events: CalendarEvent[]; fetchedAt: number }
      cachedEvents = data.events
      lastFetched = data.fetchedAt
      return cachedEvents
    }
  } catch (err) {
    logger.error('Failed to load calendar cache', { error: String(err) })
  }
  return []
}

function saveCache(events: CalendarEvent[]): void {
  try {
    const cachePath = getCachePath()
    const dir = path.dirname(cachePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(cachePath, JSON.stringify({ events, fetchedAt: Date.now() }, null, 2), 'utf-8')
  } catch (err) {
    logger.error('Failed to save calendar cache', { error: String(err) })
  }
}

export async function fetchEvents(startDate: string, endDate: string): Promise<CalendarEvent[]> {
  const auth = getAuthStatus()
  if (!auth.isAuthenticated) {
    logger.info('Calendar: not authenticated, returning cached data')
    if (cachedEvents.length === 0) {
      loadCache()
    }
    return filterByDateRange(cachedEvents, startDate, endDate)
  }

  const token = await getAccessToken()
  if (!token) {
    logger.warn('Calendar: no valid access token')
    return filterByDateRange(cachedEvents, startDate, endDate)
  }

  try {
    const client = getOAuth2Client()
    if (!client) return filterByDateRange(cachedEvents, startDate, endDate)

    const calendar = google.calendar({ version: 'v3', auth: client })
    const config = configWatcher.getConfig()

    const sources = config.calendar.sources.filter((s) => s.enabled)
    if (sources.length === 0) {
      sources.push({ id: 'primary', name: 'Primary', calendarId: 'primary', color: '#039be5', enabled: true })
    }

    const allEvents: CalendarEvent[] = []

    for (const source of sources) {
      try {
        const response = await calendar.events.list({
          calendarId: source.calendarId,
          timeMin: new Date(startDate).toISOString(),
          timeMax: new Date(endDate).toISOString(),
          maxResults: config.calendar.maxEventsPerDay * 31,
          singleEvents: true,
          orderBy: 'startTime'
        })

        const sourceEvents: CalendarEvent[] = (response.data.items || []).map((item) => ({
          id: item.id || '',
          summary: item.summary || 'Untitled',
          description: item.description || '',
          location: item.location || '',
          start: {
            dateTime: item.start?.dateTime || undefined,
            date: item.start?.date || undefined
          },
          end: {
            dateTime: item.end?.dateTime || undefined,
            date: item.end?.date || undefined
          },
          colorId: item.colorId || source.color,
          calendarId: source.calendarId
        }))

        allEvents.push(...sourceEvents)
      } catch (err) {
        logger.error('Failed to fetch calendar source', { calendarId: source.calendarId, error: String(err) })
      }
    }

    // Sort all events by start time
    const events = allEvents.sort((a, b) => {
      const aTime = new Date(a.start.dateTime || a.start.date || '').getTime()
      const bTime = new Date(b.start.dateTime || b.start.date || '').getTime()
      return aTime - bTime
    })

    cachedEvents = events
    lastFetched = Date.now()
    saveCache(events)
    logger.info('Calendar events fetched', { count: events.length })
    return filterByDateRange(events, startDate, endDate)
  } catch (err) {
    logger.error('Calendar fetch failed', { error: String(err) })
    return filterByDateRange(cachedEvents, startDate, endDate)
  }
}

function filterByDateRange(events: CalendarEvent[], start: string, end: string): CalendarEvent[] {
  const startTime = new Date(start).getTime()
  const endTime = new Date(end).getTime()

  return events.filter((event) => {
    const eventStart = new Date(event.start.dateTime || event.start.date || '').getTime()
    return eventStart >= startTime && eventStart <= endTime
  })
}

export async function forceRefresh(): Promise<void> {
  const config = configWatcher.getConfig()
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const end = new Date(now.getFullYear(), now.getMonth() + 1, config.calendar.lookaheadDays).toISOString()
  await fetchEvents(start, end)
}

export function startPolling(): void {
  if (pollInterval) clearInterval(pollInterval)

  loadCache()

  const config = configWatcher.getConfig()
  const intervalMs = config.calendar.refreshIntervalMinutes * 60 * 1000

  pollInterval = setInterval(() => {
    void forceRefresh()
  }, intervalMs)

  void forceRefresh()
  logger.info('Calendar polling started', { intervalMinutes: config.calendar.refreshIntervalMinutes })
}

export function stopPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

export function getLastFetched(): number {
  return lastFetched
}
