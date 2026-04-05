import React, { useEffect } from 'react'
import { useAppStore } from '../stores/appStore'

export const OfflineOverlay: React.FC = () => {
  const onlineStatus = useAppStore((s) => s.onlineStatus)
  const loadOnlineStatus = useAppStore((s) => s.loadOnlineStatus)

  useEffect(() => {
    void loadOnlineStatus()
    const interval = setInterval(() => void loadOnlineStatus(), 30_000)
    return () => clearInterval(interval)
  }, [loadOnlineStatus])

  const isFullyOffline = !onlineStatus.weather && !onlineStatus.calendar && !onlineStatus.nas

  if (!isFullyOffline) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-40 flex justify-center pointer-events-none">
      <div
        className="bg-yellow-900 bg-opacity-80 text-yellow-200 px-6 py-2 rounded-b-xl"
        style={{ fontSize: '16px', animation: 'fadeIn 0.5s ease-in-out' }}
      >
        Offline — using cached data
      </div>
    </div>
  )
}
