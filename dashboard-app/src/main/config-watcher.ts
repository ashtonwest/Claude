import path from 'path'
import fs from 'fs'
import { EventEmitter } from 'events'
import chokidar from 'chokidar'
import { app } from 'electron'
import { parseSettings } from '@shared/config-schema'
import type { AppSettings } from '@shared/types'
import logger from './logger'

class ConfigWatcher extends EventEmitter {
  private config: AppSettings
  private configPath: string
  private watcher: chokidar.FSWatcher | null = null

  constructor() {
    super()
    this.configPath = this.resolveConfigPath()
    this.config = this.loadConfig()
  }

  private resolveConfigPath(): string {
    try {
      const userDataPath = app.getPath('userData')
      return path.join(userDataPath, 'settings.json')
    } catch {
      return path.join(process.cwd(), 'config', 'settings.json')
    }
  }

  private loadConfig(): AppSettings {
    try {
      if (!fs.existsSync(this.configPath)) {
        const dir = path.dirname(this.configPath)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }
        const defaults = parseSettings({})
        fs.writeFileSync(this.configPath, JSON.stringify(defaults, null, 2), 'utf-8')
        logger.info('Created default settings file', { path: this.configPath })
        return defaults
      }

      const raw = fs.readFileSync(this.configPath, 'utf-8')
      const parsed = JSON.parse(raw) as unknown
      const config = parseSettings(parsed)
      logger.info('Settings loaded', { path: this.configPath })
      return config
    } catch (err) {
      logger.error('Failed to load settings, using defaults', { error: String(err) })
      return parseSettings({})
    }
  }

  startWatching(): void {
    if (this.watcher) return

    this.watcher = chokidar.watch(this.configPath, {
      persistent: true,
      ignoreInitial: true
    })

    this.watcher.on('change', () => {
      logger.info('Settings file changed, reloading')
      const newConfig = this.loadConfig()
      this.config = newConfig
      this.emit('changed', newConfig)
    })

    logger.info('Config watcher started', { path: this.configPath })
  }

  stopWatching(): void {
    if (this.watcher) {
      void this.watcher.close()
      this.watcher = null
    }
  }

  getConfig(): AppSettings {
    return this.config
  }

  getConfigPath(): string {
    return this.configPath
  }

  async updateConfig(partial: Partial<AppSettings>): Promise<void> {
    const merged = { ...this.config, ...partial }
    const validated = parseSettings(merged)
    const dir = path.dirname(this.configPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(this.configPath, JSON.stringify(validated, null, 2), 'utf-8')
    this.config = validated
    logger.info('Settings updated', { fields: Object.keys(partial) })
    this.emit('changed', validated)
  }
}

const configWatcher = new ConfigWatcher()
export default configWatcher
