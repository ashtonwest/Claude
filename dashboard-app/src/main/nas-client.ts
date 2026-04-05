import fs from 'fs'
import path from 'path'
import SMB2 from '@marsaud/smb2'
import configWatcher from './config-watcher'
import logger from './logger'

let smbClient: InstanceType<typeof SMB2> | null = null
let connectionAttempts = 0
const MAX_RECONNECT_DELAY = 60_000

function getSmbClient(): InstanceType<typeof SMB2> | null {
  const config = configWatcher.getConfig()
  if (!config.nas.host || !config.nas.share) {
    return null
  }

  if (!smbClient) {
    try {
      smbClient = new SMB2({
        share: `\\\\${config.nas.host}\\${config.nas.share}`,
        domain: config.nas.domain || '',
        username: config.nas.username,
        password: config.nas.password,
        autoCloseTimeout: 0
      })
      connectionAttempts = 0
      logger.info('SMB2 client created', { host: config.nas.host, share: config.nas.share })
    } catch (err) {
      logger.error('SMB2 client creation failed', { error: String(err) })
      smbClient = null
    }
  }

  return smbClient
}

export async function listFiles(folder: string): Promise<string[]> {
  const client = getSmbClient()
  if (client) {
    try {
      const files = await smbReadDir(client, folder)
      connectionAttempts = 0
      return files
    } catch (err) {
      logger.error('SMB2 readdir failed, trying fallback', { folder, error: String(err) })
      smbClient = null
      connectionAttempts++
    }
  }

  return fallbackReadDir(folder)
}

async function smbReadDir(client: InstanceType<typeof SMB2>, folder: string): Promise<string[]> {
  const files = await client.readdir(folder)
  return files as string[]
}

export async function smbReadFile(filePath: string): Promise<Buffer> {
  const client = getSmbClient()
  if (!client) {
    throw new Error('SMB2 client not available')
  }

  const data = await client.readFile(filePath)
  return data as Buffer
}

function fallbackReadDir(folder: string): Promise<string[]> {
  const config = configWatcher.getConfig()
  const basePath = `\\\\${config.nas.host}\\${config.nas.share}`
  const fullPath = path.join(basePath, folder)

  return new Promise((resolve) => {
    fs.readdir(fullPath, (err, files) => {
      if (err) {
        logger.warn('Fallback readdir also failed', { path: fullPath, error: String(err) })
        resolve([])
      } else {
        resolve(files || [])
      }
    })
  })
}

export async function scanAllPhotos(): Promise<string[]> {
  const config = configWatcher.getConfig()
  const extensions = new Set(config.slideshow.supportedExtensions.map((e) => e.toLowerCase()))
  const allPhotos: string[] = []

  const folders = config.nas.folders.length > 0 ? config.nas.folders : ['']

  for (const folder of folders) {
    try {
      const files = await listFiles(folder)
      for (const file of files) {
        const ext = path.extname(file).toLowerCase().replace('.', '')
        if (extensions.has(ext)) {
          allPhotos.push(folder ? path.posix.join(folder, file) : file)
        }
      }
    } catch (err) {
      logger.error('Failed to scan folder', { folder, error: String(err) })
    }
  }

  logger.info('Photo scan complete', { totalFiles: allPhotos.length })
  return allPhotos
}

export function isNasConfigured(): boolean {
  const config = configWatcher.getConfig()
  return Boolean(config.nas.host && config.nas.share)
}

export function getReconnectDelay(): number {
  return Math.min(1000 * Math.pow(2, connectionAttempts), MAX_RECONNECT_DELAY)
}

export function resetConnection(): void {
  if (smbClient) {
    try {
      void smbClient.disconnect()
    } catch {
      // ignore close errors
    }
    smbClient = null
  }
  connectionAttempts = 0
}

configWatcher.on('changed', () => {
  resetConnection()
})
