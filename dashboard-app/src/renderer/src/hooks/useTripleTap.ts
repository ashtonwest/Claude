import { useCallback, useRef } from 'react'

interface UseTripleTapOptions {
  timeout?: number
  tapCount?: number
}

export function useTripleTap(
  callback: () => void,
  options: UseTripleTapOptions = {}
): { onPointerDown: (e: React.PointerEvent) => void } {
  const { timeout = 1000, tapCount = 3 } = options
  const tapTimestamps = useRef<number[]>([])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation()
      const now = Date.now()
      tapTimestamps.current.push(now)

      // Remove taps older than timeout
      tapTimestamps.current = tapTimestamps.current.filter((t) => now - t < timeout)

      if (tapTimestamps.current.length >= tapCount) {
        tapTimestamps.current = []
        callback()
      }
    },
    [callback, timeout, tapCount]
  )

  return { onPointerDown }
}
