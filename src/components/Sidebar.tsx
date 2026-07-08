'use client'

import { useState } from 'react'
import { SearchBar } from './SearchBar'
import { RouteOptionButtons } from './RouteOptionButtons'
import { RouteDetails } from './RouteDetails'
import { RecentSearches } from './RecentSearches'

/** 패널 내용 - 데스크톱 플로팅 패널과 모바일 드로어에서 공용 */
function PanelContent() {
  return (
    <div className="flex flex-col min-h-full">
      <h1 className="text-[21px] font-semibold text-[#1d1d1f] tracking-[-0.3px] mb-6">
        길 찾기
      </h1>

      <div className="space-y-6">
        <SearchBar />
        <RouteOptionButtons />
        <RouteDetails />
      </div>

      {/* 최근 검색 - 패널 하단 고정 */}
      <div className="mt-auto pt-6">
        <RecentSearches />
      </div>
    </div>
  )
}

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Desktop: 지도 위에 떠 있는 frosted glass 패널 */}
      <aside
        className="hidden lg:flex flex-col absolute left-5 top-5 bottom-5 w-[360px] z-10 bg-[#f5f5f7]/80 backdrop-blur-2xl border border-black/[0.08] rounded-[18px] overflow-hidden"
        role="complementary"
        aria-label="경로 검색 패널"
      >
        <div className="flex-1 overflow-y-auto p-6">
          <PanelContent />
        </div>
      </aside>

      {/* Mobile: 열기 버튼 */}
      <div className="lg:hidden absolute bottom-6 left-6 z-20">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="h-[44px] px-6 bg-[#0066cc] text-white text-[15px] font-semibold tracking-[-0.2px] rounded-full active:scale-95 transition"
          aria-label="검색 패널 열기/닫기"
        >
          {isOpen ? '닫기' : '길 찾기'}
        </button>
      </div>

      {/* Mobile: frosted 드로어 */}
      {isOpen && (
        <div className="lg:hidden absolute inset-0 z-10">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setIsOpen(false)}
          ></div>
          <aside className="absolute left-3 right-3 top-3 bottom-20 bg-[#f5f5f7]/90 backdrop-blur-2xl border border-black/[0.08] rounded-[18px] overflow-y-auto">
            <div className="p-6 min-h-full flex flex-col">
              <PanelContent />
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
