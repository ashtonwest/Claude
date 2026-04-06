import { contextBridge, ipcRenderer } from 'electron'
import type { IpcChannelMap, IpcPushEvent, IpcPushEvents } from '@shared/ipc-channels'

type ElectronAPI = {
  [K in keyof IpcChannelMap]: (...args: IpcChannelMap[K]['args']) => Promise<IpcChannelMap[K]['return']>
} & {
  onPushEvent: <E extends IpcPushEvent>(
    event: E,
    callback: (data: IpcPushEvents[E]) => void
  ) => () => void
}

const api: ElectronAPI = {
  'calendar:getEvents': (startDate: string, endDate: string) =>
    ipcRenderer.invoke('calendar:getEvents', startDate, endDate),
  'calendar:refresh': () =>
    ipcRenderer.invoke('calendar:refresh'),
  'photos:getNext': () =>
    ipcRenderer.invoke('photos:getNext'),
  'photos:getQueue': (count: number) =>
    ipcRenderer.invoke('photos:getQueue', count),
  'weather:getData': () =>
    ipcRenderer.invoke('weather:getData'),
  'settings:get': () =>
    ipcRenderer.invoke('settings:get'),
  'settings:set': (settings) =>
    ipcRenderer.invoke('settings:set', settings),
  'settings:openAuthFlow': () =>
    ipcRenderer.invoke('settings:openAuthFlow'),
  'auth:getStatus': () =>
    ipcRenderer.invoke('auth:getStatus'),
  'auth:addAccount': () =>
    ipcRenderer.invoke('auth:addAccount'),
  'auth:removeAccount': (accountId: string) =>
    ipcRenderer.invoke('auth:removeAccount', accountId),
  'app:getOnlineStatus': () =>
    ipcRenderer.invoke('app:getOnlineStatus'),
  'app:restart': () =>
    ipcRenderer.invoke('app:restart'),
  onPushEvent: <E extends IpcPushEvent>(
    event: E,
    callback: (data: IpcPushEvents[E]) => void
  ) => {
    const handler = (_event: Electron.IpcRendererEvent, data: IpcPushEvents[E]): void => {
      callback(data)
    }
    ipcRenderer.on(event, handler)
    return () => {
      ipcRenderer.removeListener(event, handler)
    }
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
