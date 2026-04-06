import type { IpcChannelMap, IpcPushEvent, IpcPushEvents } from '../shared/ipc-channels'

type ElectronAPI = {
  [K in keyof IpcChannelMap]: (...args: IpcChannelMap[K]['args']) => Promise<IpcChannelMap[K]['return']>
} & {
  onPushEvent: <E extends IpcPushEvent>(
    event: E,
    callback: (data: IpcPushEvents[E]) => void
  ) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
