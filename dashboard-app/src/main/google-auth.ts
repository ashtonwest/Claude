import http from 'http'
import { URL } from 'url'
import { BrowserWindow } from 'electron'
import { OAuth2Client } from 'google-auth-library'
import Store from 'electron-store'
import type { AuthStatus } from '@shared/types'
import logger from './logger'
import configWatcher from './config-watcher'

interface StoredTokens {
  access_token: string
  refresh_token: string
  expiry_date: number
  email?: string
}

const store = new Store<{ tokens: StoredTokens }>({
  name: 'google-auth',
  encryptionKey: 'family-dashboard-oauth-v1'
})

let oauth2Client: OAuth2Client | null = null

function getClient(): OAuth2Client | null {
  const config = configWatcher.getConfig()
  if (!config.googleClientId || !config.googleClientSecret) {
    return null
  }

  if (!oauth2Client) {
    oauth2Client = new OAuth2Client(
      config.googleClientId,
      config.googleClientSecret,
      'http://localhost:0/callback'
    )

    const tokens = store.get('tokens')
    if (tokens) {
      oauth2Client.setCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date
      })
    }
  }

  return oauth2Client
}

export function getAuthStatus(): AuthStatus {
  const client = getClient()
  if (!client) {
    return { isAuthenticated: false, error: 'Google OAuth not configured — add clientId and clientSecret in settings' }
  }

  const tokens = store.get('tokens')
  if (!tokens) {
    return { isAuthenticated: false }
  }

  return {
    isAuthenticated: true,
    email: tokens.email,
    expiresAt: tokens.expiry_date
  }
}

export async function getAccessToken(): Promise<string | null> {
  const client = getClient()
  if (!client) return null

  const tokens = store.get('tokens')
  if (!tokens) return null

  if (tokens.expiry_date && Date.now() >= tokens.expiry_date - 60_000) {
    try {
      const { credentials } = await client.refreshAccessToken()
      const updated: StoredTokens = {
        access_token: credentials.access_token || tokens.access_token,
        refresh_token: credentials.refresh_token || tokens.refresh_token,
        expiry_date: credentials.expiry_date || tokens.expiry_date,
        email: tokens.email
      }
      store.set('tokens', updated)
      client.setCredentials(credentials)
      logger.info('OAuth token refreshed')
      return updated.access_token
    } catch (err) {
      logger.error('Token refresh failed', { error: String(err) })
      return null
    }
  }

  return tokens.access_token
}

export function getOAuth2Client(): OAuth2Client | null {
  return getClient()
}

export async function startAuthFlow(): Promise<AuthStatus> {
  const client = getClient()
  if (!client) {
    return { isAuthenticated: false, error: 'Google OAuth not configured' }
  }

  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (!req.url?.startsWith('/callback')) {
          res.writeHead(404)
          res.end()
          return
        }

        const url = new URL(req.url, `http://localhost`)
        const code = url.searchParams.get('code')

        if (!code) {
          res.writeHead(400)
          res.end('No authorization code received')
          resolve({ isAuthenticated: false, error: 'No authorization code received' })
          server.close()
          return
        }

        const redirectUri = `http://localhost:${(server.address() as { port: number }).port}/callback`
        const { tokens: credentials } = await client.getToken({ code, redirect_uri: redirectUri })
        client.setCredentials(credentials)

        let email: string | undefined
        try {
          const tokenInfo = await client.getTokenInfo(credentials.access_token || '')
          email = tokenInfo.email || undefined
        } catch {
          // email is optional
        }

        const stored: StoredTokens = {
          access_token: credentials.access_token || '',
          refresh_token: credentials.refresh_token || '',
          expiry_date: credentials.expiry_date || 0,
          email
        }
        store.set('tokens', stored)

        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<html><body><h1>Authenticated! You can close this window.</h1></body></html>')

        logger.info('Google OAuth completed', { email })
        resolve({
          isAuthenticated: true,
          email,
          expiresAt: stored.expiry_date
        })
      } catch (err) {
        logger.error('OAuth callback error', { error: String(err) })
        res.writeHead(500)
        res.end('Authentication failed')
        resolve({ isAuthenticated: false, error: String(err) })
      } finally {
        server.close()
      }
    })

    server.listen(0, () => {
      const port = (server.address() as { port: number }).port
      const redirectUri = `http://localhost:${port}/callback`

      const authUrl = client.generateAuthUrl({
        redirect_uri: redirectUri,
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/calendar.readonly'],
        prompt: 'consent'
      })

      const authWindow = new BrowserWindow({
        width: 600,
        height: 700,
        kiosk: false,
        alwaysOnTop: true,
        autoHideMenuBar: true,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false
        }
      })

      void authWindow.loadURL(authUrl)

      authWindow.on('closed', () => {
        server.close()
      })
    })
  })
}

export function clearAuth(): void {
  store.delete('tokens')
  oauth2Client = null
  logger.info('Google auth cleared')
}

configWatcher.on('changed', () => {
  oauth2Client = null
})
