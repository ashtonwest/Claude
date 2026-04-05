import { z } from 'zod'

export const nasConfigSchema = z.object({
  host: z.string().default(''),
  share: z.string().default('Photos'),
  username: z.string().default(''),
  password: z.string().default(''),
  folders: z.array(z.string()).default([]),
  domain: z.string().default('')
})

export const calendarConfigSchema = z.object({
  provider: z.string().default('google'),
  refreshIntervalMinutes: z.number().min(1).default(2),
  lookaheadDays: z.number().min(1).default(30),
  maxEventsPerDay: z.number().min(1).default(8)
})

export const slideshowConfigSchema = z.object({
  intervalSeconds: z.number().min(5).default(15),
  transitionMs: z.number().min(100).default(800),
  shuffled: z.boolean().default(true),
  videoEnabled: z.boolean().default(false),
  supportedExtensions: z.array(z.string()).default(['jpg', 'jpeg', 'png', 'webp']),
  maxCachedImages: z.number().min(10).default(200)
})

export const weatherConfigSchema = z.object({
  latitude: z.number().default(0),
  longitude: z.number().default(0),
  units: z.enum(['fahrenheit', 'celsius']).default('fahrenheit'),
  refreshIntervalMinutes: z.number().min(1).default(15)
})

export const nightModeConfigSchema = z.object({
  enabled: z.boolean().default(true),
  dimStart: z.string().default('22:00'),
  dimEnd: z.string().default('07:00'),
  dimOpacity: z.number().min(0).max(1).default(0.85),
  clockOnlyMode: z.boolean().default(false)
})

export const displayConfigSchema = z.object({
  showClock: z.boolean().default(true),
  showWeather: z.boolean().default(true),
  showCalendar: z.boolean().default(true),
  showSlideshow: z.boolean().default(true),
  cursorHidden: z.boolean().default(true)
})

export const burnInConfigSchema = z.object({
  enabled: z.boolean().default(true),
  panZoomEnabled: z.boolean().default(true),
  uiDriftIntervalMinutes: z.number().min(1).default(30),
  uiDriftPx: z.number().min(0).default(4)
})

export const appSettingsSchema = z.object({
  nas: nasConfigSchema.default({}),
  calendar: calendarConfigSchema.default({}),
  slideshow: slideshowConfigSchema.default({}),
  weather: weatherConfigSchema.default({}),
  nightMode: nightModeConfigSchema.default({}),
  display: displayConfigSchema.default({}),
  burnInPrevention: burnInConfigSchema.default({}),
  pin: z.string().default(''),
  googleClientId: z.string().default(''),
  googleClientSecret: z.string().default('')
})

export type AppSettingsInput = z.input<typeof appSettingsSchema>

export function parseSettings(raw: unknown): z.output<typeof appSettingsSchema> {
  const result = appSettingsSchema.safeParse(raw)
  if (result.success) {
    return result.data
  }
  return appSettingsSchema.parse({})
}
