import { useEffect } from 'react'
import { useAppStore } from '../stores/appStore'

function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [h, m] = timeStr.split(':').map(Number)
  return { hours: h || 0, minutes: m || 0 }
}

function isInNightWindow(dimStart: string, dimEnd: string): boolean {
  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const start = parseTime(dimStart)
  const end = parseTime(dimEnd)
  const startMinutes = start.hours * 60 + start.minutes
  const endMinutes = end.hours * 60 + end.minutes

  if (startMinutes <= endMinutes) {
    // Same day range (e.g., 08:00 - 17:00)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  } else {
    // Overnight range (e.g., 22:00 - 07:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes
  }
}

export function useNightMode(): { isNightMode: boolean; dimOpacity: number; clockOnlyMode: boolean; screenOff: boolean } {
  const settings = useAppStore((s) => s.settings)
  const isNightMode = useAppStore((s) => s.isNightMode)
  const setNightMode = useAppStore((s) => s.setNightMode)

  useEffect(() => {
    if (!settings?.nightMode.enabled) {
      setNightMode(false)
      return
    }

    const check = (): void => {
      const active = isInNightWindow(settings.nightMode.dimStart, settings.nightMode.dimEnd)
      setNightMode(active)
    }

    check()
    const interval = setInterval(check, 60_000)
    return () => clearInterval(interval)
  }, [settings?.nightMode.enabled, settings?.nightMode.dimStart, settings?.nightMode.dimEnd, setNightMode])

  return {
    isNightMode,
    dimOpacity: settings?.nightMode.dimOpacity ?? 0.85,
    clockOnlyMode: settings?.nightMode.clockOnlyMode ?? false,
    screenOff: settings?.nightMode.screenOff ?? true
  }
}
