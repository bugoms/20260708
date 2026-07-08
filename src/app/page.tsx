'use client'

import { MapContainer } from '@/components/MapContainer'
import { Sidebar } from '@/components/Sidebar'
import { AreaAlertModal } from '@/components/AreaAlertModal'

export default function Home() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-white">
      {/* 지도 - 전체 화면 */}
      <div className="absolute inset-0">
        <MapContainer />
      </div>

      {/* 플로팅 사이드바 */}
      <Sidebar />

      {/* 서비스 구역 이탈 경고창 */}
      <AreaAlertModal />
    </div>
  )
}
