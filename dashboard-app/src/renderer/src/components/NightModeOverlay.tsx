import React from 'react'
import { useNightMode } from '../hooks/useNightMode'
import { ClockDisplay } from './ClockDisplay'

export const NightModeOverlay: React.FC = () => {
  const { isNightMode, dimOpacity, clockOnlyMode } = useNightMode()

  if (!isNightMode) return null

  if (clockOnlyMode) {
    return (
      <div className="fixed inset-0 z-30 bg-black flex items-center justify-center">
        <ClockDisplay />
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-30 bg-black pointer-events-none"
      style={{ opacity: dimOpacity }}
    />
  )
}
