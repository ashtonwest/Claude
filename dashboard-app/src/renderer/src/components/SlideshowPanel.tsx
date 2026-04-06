import React, { useEffect, useRef } from 'react'
import { usePhotoStore } from '../stores/photoStore'
import { useAppStore } from '../stores/appStore'
import { useSwipePanel } from '../hooks/useSwipePanel'

export const SlideshowPanel: React.FC = () => {
  const currentPhoto = usePhotoStore((s) => s.currentPhoto)
  const transitioning = usePhotoStore((s) => s.transitioning)
  const loadNext = usePhotoStore((s) => s.loadNext)
  const settings = useAppStore((s) => s.settings)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const swipeHandlers = useSwipePanel({
    onSwipeLeft: () => void loadNext(),
    onSwipeRight: () => void loadNext()
  })

  useEffect(() => {
    void loadNext()
  }, [loadNext])

  useEffect(() => {
    const intervalSeconds = settings?.slideshow.intervalSeconds ?? 15
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => void loadNext(), intervalSeconds * 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [settings?.slideshow.intervalSeconds, loadNext])

  const panZoomEnabled = settings?.burnInPrevention.panZoomEnabled ?? true
  const transitionMs = settings?.slideshow.transitionMs ?? 800

  const getImageSrc = (cachePath: string): string => {
    if (cachePath.startsWith('/') || cachePath.startsWith('\\') || cachePath.match(/^[A-Z]:\\/)) {
      return `file://${cachePath.replace(/\\/g, '/')}`
    }
    return cachePath
  }

  return (
    <div
      style={{ position: 'relative', height: '100%', width: '100%', borderRadius: '16px', overflow: 'hidden', backgroundColor: '#161b22' }}
      {...swipeHandlers}
    >
      {/* Image container — clips the pan/zoom animation */}
      {currentPhoto ? (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <img
            src={getImageSrc(currentPhoto.cachePath)}
            alt={currentPhoto.filename}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              animation: panZoomEnabled ? 'panZoom 30s ease-in-out infinite' : 'none',
              transition: `opacity ${transitionMs}ms ease-in-out`,
              opacity: transitioning ? 0 : 1
            }}
          />
        </div>
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '64px' }}>📷</span>
            <p className="text-dash-text-secondary" style={{ fontSize: '22px', marginTop: '16px' }}>
              No photos available
            </p>
            <p className="text-dash-text-secondary" style={{ fontSize: '16px', marginTop: '4px' }}>
              Configure NAS in settings to display photos
            </p>
          </div>
        </div>
      )}

      {/* Caption — stays fixed, not affected by image animation */}
      {currentPhoto && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '32px 16px 12px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)',
          zIndex: 10
        }}>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>
            {currentPhoto.filename}
          </p>
        </div>
      )}
    </div>
  )
}
