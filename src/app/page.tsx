'use client'

import { MapContainer } from '@/components/MapContainer'
import { Sidebar } from '@/components/Sidebar'

export default function Home() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content - Map */}
      <div className="flex-1 relative overflow-hidden">
        <MapContainer />
      </div>
    </div>
  )
}
