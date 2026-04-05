import path from 'path'
import { app, BrowserWindow, globalShortcut } from 'electron'
import logger from './logger'
import configWatcher from './config-watcher'
import { registerAllHandlers } from './ipc-handlers'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const config = configWatcher.getConfig()

  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    kiosk: true,
    fullscreen: true,
    alwaysOnTop: true,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const blocked = [
      input.alt && input.key === 'F4',
      input.alt && input.key === 'Tab',
      input.meta,
      input.key === 'Escape',
      input.control && input.key === 'w',
      input.control && input.shift && input.key === 'I'
    ]
    if (blocked.some(Boolean)) {
      event.preventDefault()
    }
  })

  if (config.display.cursorHidden) {
    void mainWindow.webContents.insertCSS('* { cursor: none !important; }')
  }

  if (process.env.NODE_ENV === 'development' || process.env.ELECTRON_RENDERER_URL) {
    const rendererUrl = process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173'
    void mainWindow.loadURL(rendererUrl)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  logger.info('Main window created')
}

app.whenReady().then(() => {
  logger.info('Application starting')

  configWatcher.startWatching()
  registerAllHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  logger.info('All windows closed, recreating...')
  createWindow()
})

app.on('render-process-gone', (_event, _webContents, details) => {
  logger.error('Renderer crashed', { reason: details.reason, exitCode: details.exitCode })
  if (mainWindow) {
    mainWindow.reload()
  }
})

app.on('child-process-gone', (_event, details) => {
  logger.error('Child process gone', { type: details.type, reason: details.reason })
})

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack })
})

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  configWatcher.stopWatching()
  logger.info('Application shutting down')
})

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}
