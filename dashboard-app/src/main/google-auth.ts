import http from 'http'
import { URL } from 'url'
import { BrowserWindow } from 'electron'
import { OAuth2Client } from 'google-auth-library'
import Store from 'electron-store'
import type { AuthStatus, GoogleAccount } from '@shared/types'
import logger from './logger'
import configWatcher from './config-watcher'

interface StoredTokens {
  access_token: string
  refresh_token: string
  expiry_date: number
  email: string
}

interface TokenStore {
  accounts: Record<string, StoredTokens>
}

const store = new Store<TokenStore>({
  name: 'google-auth',
  encryptionKey: 'family-dashboard-oauth-v1',
  defaults: { accounts: {} }
})

const clients = new Map<string, OAuth2Client>()

function createClient(): OAuth2Client | null {
  const config = configWatcher.getConfig()
  if (!config.googleClientId || !config.googleClientSecret) {
    return null
  }
  return new OAuth2Client(
    config.googleClientId,
    config.googleClientSecret,
    'http://localhost:0/callback'
  )
}

function getClientForAccount(accountId: string): OAuth2Client | null {
  if (clients.has(accountId)) {
    return clients.get(accountId) || null
  }

  const client = createClient()
  if (!client) return null

  const accounts = store.get('accounts') || {}
  const tokens = accounts[accountId]
  if (tokens) {
    client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date
    })
  }

  clients.set(accountId, client)
  return client
}

export function getAuthStatus(): AuthStatus {
  const config = configWatcher.getConfig()
  if (!config.googleClientId || !config.googleClientSecret) {
    return {
      isAuthenticated: false,
      error: 'Google OAuth not configured — add clientId and clientSecret in settings',
      accounts: []
    }
  }

  const accounts = store.get('accounts') || {}
  const accountList: GoogleAccount[] = Object.entries(accounts).map(([id, tokens]) => ({
    id,
    email: tokens.email,
    name: tokens.email.split('@')[0] || tokens.email,
    color: '#039be5',
    enabled: true
  }))

  return {
    isAuthenticated: accountList.length > 0,
    email: accountList[0]?.email,
    accounts: accountList
  }
}

export async function getAccessTokenForAccount(accountId: string): Promise<string | null> {
  const client = getClientForAccount(accountId)
  if (!client) return null

  const accounts = store.get('accounts') || {}
  const tokens = accounts[accountId]
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
      const allAccounts = store.get('accounts') || {}
      allAccounts[accountId] = updated
      store.set('accounts', allAccounts)
      client.setCredentials(credentials)
      logger.info('OAuth token refreshed', { accountId, email: tokens.email })
      return updated.access_token
    } catch (err) {
      logger.error('Token refresh failed', { accountId, error: String(err) })
      return null
    }
  }

  return tokens.access_token
}

export function getOAuth2ClientForAccount(accountId: string): OAuth2Client | null {
  return getClientForAccount(accountId)
}

export function getAllAccountIds(): string[] {
  const accounts = store.get('accounts') || {}
  return Object.keys(accounts)
}

export async function addAccount(): Promise<GoogleAccount | null> {
  const client = createClient()
  if (!client) return null

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
          resolve(null)
          server.close()
          return
        }

        const redirectUri = `http://localhost:${(server.address() as { port: number }).port}/callback`
        const { tokens: credentials } = await client.getToken({ code, redirect_uri: redirectUri })
        client.setCredentials(credentials)

        let email = ''
        try {
          const tokenInfo = await client.getTokenInfo(credentials.access_token || '')
          email = tokenInfo.email || ''
        } catch {
          email = `account-${Date.now()}`
        }

        const accountId = email || `account-${Date.now()}`
        const stored: StoredTokens = {
          access_token: credentials.access_token || '',
          refresh_token: credentials.refresh_token || '',
          expiry_date: credentials.expiry_date || 0,
          email
        }

        const accounts = store.get('accounts') || {}
        accounts[accountId] = stored
        store.set('accounts', accounts)
        clients.set(accountId, client)

        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(`<html><body><h1>Account added: ${email}</h1><p>You can close this window.</p></body></html>`)

        logger.info('Google account added', { email })
        resolve({
          id: accountId,
          email,
          name: email.split('@')[0] || email,
          color: '#039be5',
          enabled: true
        })
      } catch (err) {
        logger.error('OAuth callback error', { error: String(err) })
        res.writeHead(500)
        res.end('Authentication failed')
        resolve(null)
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

export function removeAccount(accountId: string): void {
  const accounts = store.get('accounts') || {}
  delete accounts[accountId]
  store.set('accounts', accounts)
  clients.delete(accountId)
  logger.info('Google account removed', { accountId })
}

// Legacy compat
export async function startAuthFlow(): Promise<AuthStatus> {
  await addAccount()
  return getAuthStatus()
}

export function getAccessToken(): Promise<string | null> {
  const ids = getAllAccountIds()
  if (ids.length === 0) return Promise.resolve(null)
  return getAccessTokenForAccount(ids[0]!)
}

export function getOAuth2Client(): OAuth2Client | null {
  const ids = getAllAccountIds()
  if (ids.length === 0) return null
  return getOAuth2ClientForAccount(ids[0]!)
}

export function clearAuth(): void {
  store.set('accounts', {})
  clients.clear()
  logger.info('All Google accounts cleared')
}

configWatcher.on('changed', () => {
  clients.clear()
})
