import { ipcMain, app, net } from 'electron'
import { fetchEvents, forceRefresh, startPolling as startCalendarPolling } from './calendar-client'
import { getNext, getQueue, initialize as initPhotoCache, startRescan } from './photo-cache'
import { getData, startPolling as startWeatherPolling } from './weather-client'
import { getAuthStatus, startAuthFlow, addAccount, removeAccount } from './google-auth'
import configWatcher from './config-watcher'
import logger from './logger'
import { getMainWindow } from './main'
import type { OnlineStatus } from '@shared/types'

function pushToRenderer(channel: string, data: unknown): void {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, data)
  }
}

export function registerAllHandlers(): void {
  ipcMain.handle('calendar:getEvents', async (_event, startDate: string, endDate: string) => {
    try {
      return await fetchEvents(startDate, endDate)
    } catch (err) {
      logger.error('IPC calendar:getEvents failed', { error: String(err) })
      return []
    }
  })

  ipcMain.handle('calendar:refresh', async () => {
    try {
      await forceRefresh()
    } catch (err) {
      logger.error('IPC calendar:refresh failed', { error: String(err) })
    }
  })

  ipcMain.handle('photos:getNext', async () => {
    try {
      return await getNext()
    } catch (err) {
      logger.error('IPC photos:getNext failed', { error: String(err) })
      return null
    }
  })

  ipcMain.handle('photos:getQueue', async (_event, count: number) => {
    try {
      return await getQueue(count)
    } catch (err) {
      logger.error('IPC photos:getQueue failed', { error: String(err) })
      return []
    }
  })

  ipcMain.handle('weather:getData', () => {
    try {
      return getData()
    } catch (err) {
      logger.error('IPC weather:getData failed', { error: String(err) })
      return null
    }
  })

  ipcMain.handle('settings:get', () => {
    return configWatcher.getConfig()
  })

  ipcMain.handle('settings:set', async (_event, partial: Record<string, unknown>) => {
    try {
      await configWatcher.updateConfig(partial)
    } catch (err) {
      logger.error('IPC settings:set failed', { error: String(err) })
    }
  })

  ipcMain.handle('settings:openAuthFlow', async () => {
    try {
      return await startAuthFlow()
    } catch (err) {
      logger.error('IPC settings:openAuthFlow failed', { error: String(err) })
      return { isAuthenticated: false, error: String(err), accounts: [] }
    }
  })

  ipcMain.handle('auth:addAccount', async () => {
    try {
      return await addAccount()
    } catch (err) {
      logger.error('IPC auth:addAccount failed', { error: String(err) })
      return null
    }
  })

  ipcMain.handle('auth:removeAccount', (_event, accountId: string) => {
    removeAccount(accountId)
  })

  ipcMain.handle('auth:getStatus', () => {
    return getAuthStatus()
  })

  ipcMain.handle('app:getOnlineStatus', (): OnlineStatus => {
    return {
      nas: false,
      calendar: getAuthStatus().isAuthenticated,
      weather: net.isOnline()
    }
  })

  ipcMain.handle('app:restart', () => {
    logger.info('App restart requested via IPC')
    app.relaunch()
    app.exit(0)
  })

  // Push config changes to renderer
  configWatcher.on('changed', (config) => {
    pushToRenderer('config:changed', config)
  })

  // Start background services (wrapped in try-catch so failures don't block UI)
  try {
    void initPhotoCache()
    startRescan()
  } catch (err) {
    logger.error('Photo cache init failed', { error: String(err) })
  }
  try {
    startCalendarPolling()
  } catch (err) {
    logger.error('Calendar polling start failed', { error: String(err) })
  }
  try {
    startWeatherPolling()
  } catch (err) {
    logger.error('Weather polling start failed', { error: String(err) })
  }

  logger.info('All IPC handlers registered and services started')
}
