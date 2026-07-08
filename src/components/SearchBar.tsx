'use client'

import { useState, useCallback, useEffect, useRef, useId } from 'react'
import { useRouteStore } from '@/store/routeStore'
import { pointInPolygon } from '@/utils/geo'
import type { Location, PoiResult } from '@/types/route'

/** 좌표가 서비스 구역(역삼동) 안인지 판정. 경계 미로드 시 통과 */
function isInServiceArea(
  lat: number,
  lng: number,
  boundary: Array<Array<[number, number]>> | null
): boolean {
  if (!boundary || boundary.length === 0) return true
  return boundary.some((ring) =>
    pointInPolygon(
      { lat, lng },
      ring.map((c) => ({ lat: c[1], lng: c[0] }))
    )
  )
}

interface LocationFieldProps {
  label: string
  placeholder: string
  location: Location | null
  onSelect: (location: Location | null) => void
}

function LocationField({
  label,
  placeholder,
  location,
  onSelect,
}: LocationFieldProps) {
  const inputId = useId()
  const [input, setInput] = useState(location?.name || '')
  const [results, setResults] = useState<PoiResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [areaWarning, setAreaWarning] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { boundary } = useRouteStore()

  const search = useCallback(
    async (keyword: string) => {
      if (!keyword.trim()) {
        setResults([])
        setIsOpen(false)
        return
      }

      setIsSearching(true)
      try {
        const response = await fetch(
          `/api/poi?keyword=${encodeURIComponent(keyword.trim())}`
        )
        if (!response.ok) throw new Error('검색 실패')
        const data = (await response.json()) as { results: PoiResult[] }
        setResults(data.results)
        setIsOpen(true)
      } catch {
        setResults([])
        setIsOpen(false)
      } finally {
        setIsSearching(false)
      }
    },
    []
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setInput(value)
      // 입력을 수정하면 기존 확정 위치/경고 해제
      onSelect(null)
      setAreaWarning(null)

      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => search(value), 400)
    },
    [onSelect, search]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (debounceRef.current) clearTimeout(debounceRef.current)
        search(input)
      }
    },
    [input, search]
  )

  const handlePick = useCallback(
    (poi: PoiResult) => {
      // 서비스 구역(역삼동) 밖이면 선택을 막고 안내
      if (!isInServiceArea(poi.lat, poi.lng, boundary)) {
        setAreaWarning(
          `'${poi.name}'은(는) 서비스 구역 밖이에요. 역삼동 안의 장소를 선택해주세요.`
        )
        setIsOpen(false)
        return
      }

      setAreaWarning(null)
      setInput(poi.name)
      setResults([])
      setIsOpen(false)
      onSelect({ name: poi.name, lat: poi.lat, lng: poi.lng })
    },
    [onSelect, boundary]
  )

  // 바깥 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type="text"
          placeholder={placeholder}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          aria-label={`${label} 입력`}
          autoComplete="off"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
          {isSearching ? (
            <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          ) : location ? (
            <span className="text-green-500" title="위치 확정됨">
              ✓
            </span>
          ) : (
            <span className="text-gray-400">🔍</span>
          )}
        </span>
      </div>

      {areaWarning && (
        <p
          className="mt-1.5 text-xs text-amber-600 dark:text-amber-400"
          role="alert"
        >
          ⚠️ {areaWarning}
        </p>
      )}

      {isOpen && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.length === 0 ? (
            <li className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              검색 결과가 없습니다.
            </li>
          ) : (
            results.map((poi, index) => (
              <li key={`${poi.name}-${index}`}>
                <button
                  type="button"
                  onClick={() => handlePick(poi)}
                  className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <span className="block text-sm font-medium text-gray-900 dark:text-white">
                    {poi.name}
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                    {poi.address}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

export function SearchBar() {
  const { startLocation, endLocation, setStartLocation, setEndLocation } =
    useRouteStore()

  return (
    <div className="space-y-3">
      <LocationField
        label="출발지"
        placeholder="출발지를 검색하세요 (예: 강남역)"
        location={startLocation}
        onSelect={setStartLocation}
      />
      <LocationField
        label="도착지"
        placeholder="도착지를 검색하세요 (예: 역삼역)"
        location={endLocation}
        onSelect={setEndLocation}
      />
      <p className="text-xs text-gray-500 dark:text-gray-400">
        장소를 검색하고 목록에서 선택하면 지도에 마커가 표시됩니다. 서비스
        구역은 강남구 역삼동입니다 (지도의 코랄색 경계선).
      </p>
    </div>
  )
}
