import { useCallback, useRef } from 'react'

interface SwipeHandlers {
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
}

interface UseSwipePanelOptions {
  threshold?: number
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
}

export function useSwipePanel(options: UseSwipePanelOptions = {}): SwipeHandlers {
  const { threshold = 50, onSwipeLeft, onSwipeRight } = options
  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    startX.current = e.clientX
    startY.current = e.clientY
  }, [])

  const onPointerMove = useCallback((_e: React.PointerEvent) => {
    // Track movement if needed for visual feedback
  }, [])

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (startX.current === null || startY.current === null) return

      const dx = e.clientX - startX.current
      const dy = e.clientY - startY.current

      // Only trigger if horizontal movement is dominant
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
        if (dx < 0 && onSwipeLeft) {
          onSwipeLeft()
        } else if (dx > 0 && onSwipeRight) {
          onSwipeRight()
        }
      }

      startX.current = null
      startY.current = null
    },
    [threshold, onSwipeLeft, onSwipeRight]
  )

  return { onPointerDown, onPointerMove, onPointerUp }
}
