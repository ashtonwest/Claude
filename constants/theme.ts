export const colors = {
  background: '#080808',
  surface: '#111111',
  surfaceBorder: '#1e1e1e',
  primary: '#00ff88',
  primaryDim: 'rgba(0, 255, 136, 0.4)',
  primaryBg: '#0d1a12',
  error: '#ff4444',
  panelBg: '#0e0e0e',
  panelBorder: 'rgba(0, 255, 136, 0.3)',
  rule: '#1a1a1a',
  rowBorder: '#151515',
  controlBorder: '#222222',
  title: '#333333',
  subtitle: '#444444',
  windowTitle: '#cccccc',
  status: '#555555',
  hostIp: '#333333',
  fpsCounter: 'rgba(0, 255, 136, 0.6)',
} as const;

export const fonts = {
  mono: 'JetBrainsMono_400Regular',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

export const typography = {
  brandTitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: 4.4,
    color: colors.title,
  },
  screenTitle: {
    fontFamily: fonts.mono,
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: 4,
    color: colors.subtitle,
  },
  windowTitle: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.windowTitle,
  },
  ipInput: {
    fontFamily: fonts.mono,
    fontSize: 18,
    color: colors.primary,
  },
  status: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.status,
  },
  fpsOverlay: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.fpsCounter,
  },
  hostOverlay: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.hostIp,
  },
  panelHeader: {
    fontFamily: fonts.mono,
    fontSize: 9,
    textTransform: 'uppercase' as const,
    letterSpacing: 3.6,
    color: colors.title,
  },
  connectButton: {
    fontFamily: fonts.mono,
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: 4,
    color: colors.primary,
  },
} as const;

export const sizing = {
  controlButton: 44,
  windowRowHeight: 48,
  panelHeightPercent: 0.6,
  activeBorderWidth: 2,
  inputBorderRadius: 2,
  iconSize: 16,
} as const;

export const timing = {
  panelSlide: 220,
  opacityFade: 150,
  overlayAutoHide: 3000,
  buttonFlash: 150,
  dotCycle: 400,
} as const;
