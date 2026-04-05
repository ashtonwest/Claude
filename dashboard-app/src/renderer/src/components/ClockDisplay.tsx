import React, { useState, useEffect } from 'react'

function formatTime(date: Date): string {
  const h = date.getHours()
  const m = date.getMinutes().toString().padStart(2, '0')
  const hour = h.toString().padStart(2, '0')
  return `${hour}:${m}`
}

function formatDate(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  const dayName = days[date.getDay()]
  const monthName = months[date.getMonth()]
  return `${dayName}, ${monthName} ${date.getDate()}`
}

export const ClockDisplay: React.FC = () => {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col">
      <span className="text-dash-text font-bold font-mono leading-none" style={{ fontSize: '96px' }}>
        {formatTime(now)}
      </span>
      <span className="text-dash-text-secondary font-semibold mt-1" style={{ fontSize: '28px' }}>
        {formatDate(now)}
      </span>
    </div>
  )
}
