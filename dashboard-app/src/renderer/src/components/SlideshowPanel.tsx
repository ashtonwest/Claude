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
      className="relative h-full w-full rounded-2xl overflow-hidden bg-dash-surface"
      {...swipeHandlers}
    >
      {currentPhoto ? (
        <img
          src={getImageSrc(currentPhoto.cachePath)}
          alt={currentPhoto.filename}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            animation: panZoomEnabled ? 'panZoom 30s ease-in-out infinite' : 'none',
            transition: `opacity ${transitionMs}ms ease-in-out`,
            opacity: transitioning ? 0 : 1
          }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <span style={{ fontSize: '64px' }}>📷</span>
            <p className="text-dash-text-secondary mt-4" style={{ fontSize: '22px' }}>
              No photos available
            </p>
            <p className="text-dash-text-secondary mt-1" style={{ fontSize: '16px' }}>
              Configure NAS in settings to display photos
            </p>
          </div>
        </div>
      )}

      {currentPhoto && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-4">
          <p className="text-white text-opacity-70" style={{ fontSize: '14px' }}>
            {currentPhoto.filename}
          </p>
        </div>
      )}
    </div>
  )
}
