# Family Dashboard

A 24/7 wall-mounted family dashboard built with Electron, React, and TypeScript. Designed for the Beelink Mini S12 Pro + Wacom Cintiq 13HD Touch (1920x1080, Windows 11 Pro).

## Features

- **Calendar** — Google Calendar integration with month view and daily agenda
- **Photo Slideshow** — NAS-sourced photos with crossfade transitions and burn-in prevention
- **Weather** — Current conditions + 3-day forecast via Open-Meteo (free, no API key)
- **Clock** — Large digital clock with date display
- **Night Mode** — Scheduled dimming with optional clock-only mode
- **Touch-First** — Triple-tap settings panel, swipe navigation, no keyboard needed
- **Self-Recovering** — pm2 watchdog, crash recovery, offline fallbacks
- **Kiosk Mode** — Fullscreen, no OS chrome, blocked exit shortcuts

## Prerequisites

- **Node.js** 20+ with npm
- **Git**
- **pm2** (global install): `npm install -g pm2`
- **Windows 11 Pro** (target platform)

## Clone & Install

```bash
git clone <repo-url>
cd dashboard-app
npm install
```

### Rebuild native modules for Electron

```bash
npx electron-rebuild -f -w sharp
```

## First-Run Configuration

Edit `config/settings.json` with your specific values:

```json
{
  "nas": {
    "host": "192.168.1.100",
    "share": "Photos",
    "username": "dashboard",
    "password": "your_password",
    "folders": ["Family", "Vacations"]
  },
  "weather": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "units": "fahrenheit"
  }
}
```

Or configure everything from the touch Settings Panel (triple-tap top-right corner of screen).

## Google Calendar Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (e.g., "Family Dashboard")
3. Enable the **Google Calendar API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Desktop app**
6. Download the credentials
7. Add `googleClientId` and `googleClientSecret` to `config/settings.json`:

```json
{
  "googleClientId": "your-client-id.apps.googleusercontent.com",
  "googleClientSecret": "your-client-secret"
}
```

8. Launch the app and open Settings (triple-tap top-right corner)
9. Click **Connect Google Calendar**
10. Complete the OAuth flow in the popup window
11. The refresh token is stored encrypted locally — no re-auth needed unless revoked

**Scopes used:** `calendar.readonly` (read-only access to your calendar)

## NAS Setup

1. Create a **read-only** user on your NAS (e.g., username: `dashboard`)
2. Enable SMB/CIFS sharing
3. Configure the NAS connection in `config/settings.json` or via the Settings panel
4. The dashboard scans configured folders every 30 minutes for new photos
5. Photos are downscaled and cached locally (max 200 images, ~200MB disk)

**Fallback:** If SMB2 fails, the app tries to read from the Windows mapped drive path (`\\host\share`). You can also map the NAS as a drive letter in Windows.

## Running in Development

```bash
npm run dev
```

## Building for Production

```bash
npm run build        # Compile TypeScript + bundle
npm run build:win    # Build Windows installer (NSIS)
```

The installer will be in the `dist/` directory.

## Windows Autostart Setup

### Using pm2 (recommended)

```bash
# Start the dashboard
pm2 start ecosystem.config.js

# Save the process list
pm2 save

# Register pm2 as a Windows startup service
pm2-startup install
```

### Using Task Scheduler (alternative)

1. Open **Task Scheduler** → **Create Task**
2. **General tab:**
   - Name: `Family Dashboard`
   - Run whether user is logged on or not
   - Run with highest privileges
3. **Trigger:** At log on (any user)
4. **Action:** Start a program
   - Program: `C:\Users\<user>\AppData\Roaming\npm\pm2.cmd`
   - Arguments: `start C:\dashboard-app\ecosystem.config.js --no-daemon`
5. **Settings:**
   - Restart if task fails (every 1 minute, up to 10 times)
   - Run task as soon as possible after scheduled start is missed

## Using the Settings Panel

1. **Triple-tap** the top-right corner of the screen (60x60px zone, 3 taps within 1 second)
2. Enter PIN if configured (4-digit)
3. Configure: NAS, Google Calendar, Weather location, Slideshow speed, Night Mode schedule
4. Changes save automatically to `config/settings.json`
5. Triple-tap again or press X to close

## Updating Photos

- Add photos to the configured NAS folder(s)
- Supported formats: JPG, JPEG, PNG, WebP
- The dashboard auto-detects new photos within 30 minutes
- Photos are downscaled to 1920x1080 max and cached locally as JPEG (quality 85)

## Night Mode

Configure in settings or `config/settings.json`:
- **dimStart / dimEnd** — Schedule (e.g., `"22:00"` to `"07:00"`)
- **dimOpacity** — How dark the overlay is (0.0 to 1.0, default 0.85)
- **clockOnlyMode** — Show only the clock during night hours

## Logs

Logs are stored in the app's user data directory under `logs/`:
- Daily rotation, 7-day retention, 10MB max per file
- Format: JSON with timestamps

**What to look for:**
- `NAS connect/disconnect` — SMB2 connection issues
- `Calendar fetch failed` — Google auth issues
- `Weather fetch failed` — Network issues
- `Renderer crashed` — UI crash and recovery

## Troubleshooting

| Issue | Solution |
|-------|----------|
| NAS not connecting | Verify host IP, share name, and credentials. Check if SMB is enabled on NAS. Try mapping the share as a drive letter in Windows. |
| Calendar auth expired | Open Settings → Connect Google Calendar. If it keeps failing, delete the stored tokens and re-authenticate. |
| Weather not showing | Set latitude/longitude in settings. The dashboard needs valid coordinates. |
| Wacom touch not responding | Ensure Wacom drivers are installed. The Cintiq 13HD Touch uses standard USB HID — no special driver needed for basic touch. |
| App won't start | Check `logs/` for error details. Try `npm run dev` for console output. Ensure Node 20+ is installed. |
| Screen burn-in | Burn-in prevention is enabled by default. Increase `uiDriftPx` or decrease `uiDriftIntervalMinutes` in settings. |
| Photos not updating | Check NAS connectivity. New photos are detected every 30 minutes. Restart the app to force a re-scan. |

## Architecture

```
Main Process (Node.js)         Renderer (React)
├── logger.ts                  ├── App.tsx
├── config-watcher.ts          ├── components/
├── google-auth.ts             │   ├── ClockDisplay
├── calendar-client.ts         │   ├── WeatherWidget
├── nas-client.ts              │   ├── CalendarPanel
├── photo-cache.ts             │   ├── SlideshowPanel
├── weather-client.ts          │   ├── SettingsPanel
├── ipc-handlers.ts            │   ├── OfflineOverlay
└── main.ts                    │   └── NightModeOverlay
                               ├── stores/ (Zustand)
    Preload (Bridge)           └── hooks/
    └── preload.ts                 ├── useTripleTap
                                   ├── useSwipePanel
                                   └── useNightMode
```

All communication between main and renderer goes through typed IPC channels with `contextIsolation: true`.
