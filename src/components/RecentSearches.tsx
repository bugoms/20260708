'use client'

import { useEffect, useCallback } from 'react'
import { useRouteStore } from '@/store/routeStore'
import {
  loadRecentSearches,
  clearRecentSearches,
  type RecentSearch,
} from '@/utils/recentSearches'

export function RecentSearches() {
  const {
    recentSearches,
    setRecentSearches,
    setStartLocation,
    setEndLocation,
  } = useRouteStore()

  // 최초 마운트 시 localStorage에서 복원
  useEffect(() => {
    setRecentSearches(loadRecentSearches())
  }, [setRecentSearches])

  const handlePick = useCallback(
    (item: RecentSearch) => {
      setStartLocation(item.start)
      setEndLocation(item.end)
    },
    [setStartLocation, setEndLocation]
  )

  const handleClear = useCallback(() => {
    clearRecentSearches()
    setRecentSearches([])
  }, [setRecentSearches])

  if (recentSearches.length === 0) return null

  return (
    <div className="border-t border-[#e0e0e0] pt-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[14px] font-semibold text-[#1d1d1f] tracking-[-0.224px]">
          최근 검색
        </h2>
        <button
          onClick={handleClear}
          className="text-[12px] text-[#0066cc] active:scale-95 transition-transform"
        >
          지우기
        </button>
      </div>

      <ul>
        {recentSearches.map((item) => (
          <li key={`${item.start.name}-${item.end.name}-${item.ts}`}>
            <button
              onClick={() => handlePick(item)}
              className="w-full text-left px-2 py-2 -mx-2 rounded-[8px] hover:bg-black/[0.04] active:scale-[0.98] transition"
            >
              <span className="block text-[14px] text-[#1d1d1f] tracking-[-0.224px] truncate">
                {item.start.name}
                <span className="text-[#86868b] mx-1.5">→</span>
                {item.end.name}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
