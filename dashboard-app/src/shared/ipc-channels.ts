import type { CalendarEvent, WeatherData, PhotoMeta, AppSettings, AuthStatus, OnlineStatus } from './types'

export interface IpcChannelMap {
  'calendar:getEvents': { args: [startDate: string, endDate: string]; return: CalendarEvent[] }
  'calendar:refresh': { args: []; return: void }
  'photos:getNext': { args: []; return: PhotoMeta | null }
  'photos:getQueue': { args: [count: number]; return: PhotoMeta[] }
  'weather:getData': { args: []; return: WeatherData | null }
  'settings:get': { args: []; return: AppSettings }
  'settings:set': { args: [settings: Partial<AppSettings>]; return: void }
  'settings:openAuthFlow': { args: []; return: AuthStatus }
  'auth:getStatus': { args: []; return: AuthStatus }
  'app:getOnlineStatus': { args: []; return: OnlineStatus }
  'app:restart': { args: []; return: void }
}

export type IpcChannel = keyof IpcChannelMap

export type IpcPushEvents = {
  'config:changed': AppSettings
  'online:changed': OnlineStatus
  'auth:changed': AuthStatus
}

export type IpcPushEvent = keyof IpcPushEvents
