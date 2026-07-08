'use client'

import { useState, useCallback } from 'react'
import { MapContainer } from '@/components/MapContainer'
import { Sidebar } from '@/components/Sidebar'

export default function Home() {
  const [isDarkMode, setIsDarkMode] = useState(false)

  const handleToggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => !prev)
    const html = document.documentElement
    if (!isDarkMode) {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }, [isDarkMode])

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-slate-900">
        {/* Sidebar */}
        <Sidebar
          onToggleDarkMode={handleToggleDarkMode}
          isDarkMode={isDarkMode}
        />

        {/* Main Content - Map */}
        <div className="flex-1 relative overflow-hidden">
          <MapContainer />
        </div>
      </div>
    </div>
  )
}
