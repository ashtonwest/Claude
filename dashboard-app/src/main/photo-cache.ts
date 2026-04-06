import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import sharp from 'sharp'
import { scanAllPhotos, smbReadFile, isNasConfigured } from './nas-client'
import configWatcher from './config-watcher'
import logger from './logger'
import type { PhotoMeta } from '@shared/types'

let photoIndex: string[] = []
let currentPosition = 0
let processingQueue: Promise<void> = Promise.resolve()
let rescanInterval: ReturnType<typeof setInterval> | null = null
let activeConcurrent = 0
const MAX_CONCURRENT = 3

function getCacheDir(): string {
  return path.join(process.cwd(), 'cache', 'photos')
}

function getFallbackDir(): string {
  return path.join(process.cwd(), 'assets', 'fallback-photos')
}

function ensureCacheDir(): void {
  const dir = getCacheDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function hashPath(filePath: string): string {
  return crypto.createHash('md5').update(filePath).digest('hex')
}

function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = shuffled[i]!
    shuffled[i] = shuffled[j]!
    shuffled[j] = temp
  }
  return shuffled
}

async function waitForSlot(): Promise<void> {
  while (activeConcurrent >= MAX_CONCURRENT) {
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

async function processImage(remotePath: string): Promise<PhotoMeta | null> {
  const hash = hashPath(remotePath)
  const cachePath = path.join(getCacheDir(), `${hash}.jpg`)

  if (fs.existsSync(cachePath)) {
    try {
      const metadata = await sharp(cachePath).metadata()
      return {
        id: hash,
        originalPath: remotePath,
        cachePath,
        width: metadata.width || 1920,
        height: metadata.height || 1080,
        filename: path.basename(remotePath)
      }
    } catch {
      fs.unlinkSync(cachePath)
    }
  }

  await waitForSlot()
  activeConcurrent++

  try {
    const buffer = await smbReadFile(remotePath)
    const metadata = await sharp(buffer)
      .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(cachePath)

    return {
      id: hash,
      originalPath: remotePath,
      cachePath,
      width: metadata.width,
      height: metadata.height,
      filename: path.basename(remotePath)
    }
  } catch (err) {
    logger.error('Image processing failed', { remotePath, error: String(err) })
    return null
  } finally {
    activeConcurrent--
  }
}

function loadFallbackPhotos(): PhotoMeta[] {
  const dir = getFallbackDir()
  if (!fs.existsSync(dir)) return []

  try {
    const files = fs.readdirSync(dir)
    return files
      .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
      .map((f) => ({
        id: hashPath(f),
        originalPath: path.join(dir, f),
        cachePath: path.join(dir, f),
        width: 1920,
        height: 1080,
        filename: f
      }))
  } catch {
    return []
  }
}

function getCachedPhotos(): PhotoMeta[] {
  const dir = getCacheDir()
  if (!fs.existsSync(dir)) return []

  try {
    const files = fs.readdirSync(dir)
    return files
      .filter((f) => f.endsWith('.jpg'))
      .map((f) => ({
        id: path.basename(f, '.jpg'),
        originalPath: '',
        cachePath: path.join(dir, f),
        width: 1920,
        height: 1080,
        filename: f
      }))
  } catch {
    return []
  }
}

function enforceMaxCache(): void {
  const config = configWatcher.getConfig()
  const dir = getCacheDir()
  if (!fs.existsSync(dir)) return

  const files = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.jpg'))
    .map((f) => ({
      name: f,
      path: path.join(dir, f),
      mtime: fs.statSync(path.join(dir, f)).mtimeMs
    }))
    .sort((a, b) => b.mtime - a.mtime)

  if (files.length > config.slideshow.maxCachedImages) {
    const toRemove = files.slice(config.slideshow.maxCachedImages)
    for (const file of toRemove) {
      try {
        fs.unlinkSync(file.path)
      } catch {
        // ignore
      }
    }
    logger.info('Cache eviction', { removed: toRemove.length })
  }
}

export async function initialize(): Promise<void> {
  ensureCacheDir()

  if (!isNasConfigured()) {
    logger.info('NAS not configured, using fallback/cache photos')
    return
  }

  processingQueue = processingQueue.then(async () => {
    try {
      const photos = await scanAllPhotos()
      const config = configWatcher.getConfig()
      photoIndex = config.slideshow.shuffled ? shuffle(photos) : photos
      currentPosition = 0

      const prefetchCount = Math.min(5, photoIndex.length)
      for (let i = 0; i < prefetchCount; i++) {
        const remotePath = photoIndex[i]
        if (remotePath) {
          await processImage(remotePath)
        }
      }

      enforceMaxCache()
      logger.info('Photo cache initialized', { total: photoIndex.length, prefetched: prefetchCount })
    } catch (err) {
      logger.error('Photo cache initialization failed', { error: String(err) })
    }
  })

  await processingQueue
}

export async function getNext(): Promise<PhotoMeta | null> {
  if (photoIndex.length === 0) {
    const cached = getCachedPhotos()
    if (cached.length > 0) {
      const idx = Math.floor(Math.random() * cached.length)
      return cached[idx] || null
    }
    const fallback = loadFallbackPhotos()
    if (fallback.length > 0) {
      const idx = Math.floor(Math.random() * fallback.length)
      return fallback[idx] || null
    }
    return null
  }

  if (currentPosition >= photoIndex.length) {
    const config = configWatcher.getConfig()
    photoIndex = config.slideshow.shuffled ? shuffle(photoIndex) : photoIndex
    currentPosition = 0
  }

  const remotePath = photoIndex[currentPosition]
  currentPosition++

  if (!remotePath) return null

  const meta = await processImage(remotePath)
  if (!meta) {
    const cached = getCachedPhotos()
    if (cached.length > 0) {
      const idx = Math.floor(Math.random() * cached.length)
      return cached[idx] || null
    }
    return null
  }

  // Pre-fetch next few images in background
  const prefetchCount = Math.min(3, photoIndex.length - currentPosition)
  for (let i = 0; i < prefetchCount; i++) {
    const nextPath = photoIndex[currentPosition + i]
    if (nextPath) {
      void processImage(nextPath)
    }
  }

  return meta
}

export async function getQueue(count: number): Promise<PhotoMeta[]> {
  const results: PhotoMeta[] = []
  for (let i = 0; i < count; i++) {
    const photo = await getNext()
    if (photo) {
      results.push(photo)
    }
  }
  return results
}

export function startRescan(): void {
  if (rescanInterval) clearInterval(rescanInterval)

  rescanInterval = setInterval(() => {
    void initialize()
  }, 30 * 60 * 1000)
}

export function stopRescan(): void {
  if (rescanInterval) {
    clearInterval(rescanInterval)
    rescanInterval = null
  }
}
