import React, { useState, useEffect, useCallback } from 'react'
import { useNightMode } from '../hooks/useNightMode'
import { ClockDisplay } from './ClockDisplay'

export const NightModeOverlay: React.FC = () => {
  const { isNightMode, dimOpacity, clockOnlyMode, screenOff } = useNightMode()
  const [awake, setAwake] = useState(false)
  const [awakeTimer, setAwakeTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const handleWake = useCallback(() => {
    setAwake(true)
    if (awakeTimer) clearTimeout(awakeTimer)
    const timer = setTimeout(() => setAwake(false), 30_000)
    setAwakeTimer(timer)
  }, [awakeTimer])

  // Reset awake state when night mode turns off
  useEffect(() => {
    if (!isNightMode) {
      setAwake(false)
      if (awakeTimer) clearTimeout(awakeTimer)
    }
  }, [isNightMode, awakeTimer])

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (awakeTimer) clearTimeout(awakeTimer)
    }
  }, [awakeTimer])

  if (!isNightMode) return null

  // Screen off mode — completely black, tap to wake temporarily
  if (screenOff && !awake) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 30,
          backgroundColor: '#000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer'
        }}
        onClick={handleWake}
        onPointerDown={handleWake}
      >
        {/* Tiny subtle dot so the user knows the screen isn't dead */}
        <div style={{
          width: '4px',
          height: '4px',
          borderRadius: '50%',
          backgroundColor: '#1a1a1a'
        }} />
      </div>
    )
  }

  // Screen off but awake — show clock with countdown
  if (screenOff && awake) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 30,
          backgroundColor: '#000000',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px'
        }}
        onClick={handleWake}
      >
        <ClockDisplay />
        <p style={{ fontSize: '14px', color: '#333' }}>
          Tap to stay awake
        </p>
      </div>
    )
  }

  // Clock only mode
  if (clockOnlyMode) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 30,
          backgroundColor: '#000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <ClockDisplay />
      </div>
    )
  }

  // Dim overlay mode
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 30,
        backgroundColor: '#000000',
        opacity: dimOpacity,
        pointerEvents: 'none'
      }}
    />
  )
}
