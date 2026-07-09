'use client'

import { useState, useCallback, useEffect, useRef, useId } from 'react'
import { useRouteStore } from '@/store/routeStore'
import { pointInPolygon } from '@/utils/geo'
import type { Location, PoiResult } from '@/types/route'

/**
 * POI가 서비스 구역(역삼동) 안인지 판정.
 * 경계 폴리곤이 로드됐으면 좌표 기반, 미로드(Overpass 장애 등) 시엔
 * 주소 문자열 기반으로 폴백 - 어떤 경우에도 구역 밖이 통과되지 않게.
 */
function isInServiceArea(
  poi: { lat: number; lng: number; address: string },
  boundary: Array<Array<[number, number]>> | null
): boolean {
  if (boundary && boundary.length > 0) {
    return boundary.some((ring) =>
      pointInPolygon(
        { lat: poi.lat, lng: poi.lng },
        ring.map((c) => ({ lat: c[1], lng: c[0] }))
      )
    )
  }
  return poi.address.includes('역삼동')
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
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { boundary, setAreaAlert } = useRouteStore()

  // 외부에서 위치가 설정되면(최근 검색 클릭 등) 입력창 동기화
  useEffect(() => {
    if (location && location.name !== input) {
      setInput(location.name)
      setResults([])
      setIsOpen(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location])

  const search = useCallback(async (keyword: string) => {
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
  }, [])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setInput(value)
      // 입력을 수정하면 기존 확정 위치 해제
      onSelect(null)

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
      // 서비스 구역(역삼동) 밖이면 선택을 막고 경고창 표시
      if (!isInServiceArea(poi, boundary)) {
        setAreaAlert(
          `'${poi.name}'은(는) 역삼동을 벗어난 장소예요. 역삼동 안의 장소를 선택해주세요.`
        )
        setIsOpen(false)
        return
      }

      setInput(poi.name)
      setResults([])
      setIsOpen(false)
      onSelect({ name: poi.name, lat: poi.lat, lng: poi.lng })
    },
    [onSelect, boundary, setAreaAlert]
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
        className="block text-[14px] font-semibold text-[#1d1d1f] tracking-[-0.224px] mb-2"
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
          className="w-full h-[44px] px-5 pr-10 text-[15px] text-[#1d1d1f] tracking-[-0.2px] bg-white border border-black/[0.08] rounded-full focus:outline-none focus:ring-2 focus:ring-[#0071e3] focus:border-transparent transition-shadow"
          aria-label={`${label} 입력`}
          autoComplete="off"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm">
          {isSearching ? (
            <span className="inline-block w-4 h-4 border-2 border-[#d2d2d7] border-t-[#0066cc] rounded-full animate-spin" />
          ) : location ? (
            <span className="text-[#0066cc]" title="위치 확정됨">
              ✓
            </span>
          ) : null}
        </span>
      </div>

      {isOpen && (
        <ul className="absolute z-50 left-0 right-0 mt-2 bg-white border border-[#e0e0e0] rounded-[18px] shadow-none max-h-60 overflow-y-auto overflow-x-hidden py-1">
          {results.length === 0 ? (
            <li className="px-5 py-3 text-[14px] text-[#86868b] tracking-[-0.224px]">
              검색 결과가 없습니다.
            </li>
          ) : (
            results.map((poi, index) => (
              <li key={`${poi.name}-${index}`}>
                <button
                  type="button"
                  onClick={() => handlePick(poi)}
                  className="w-full text-left px-5 py-2.5 hover:bg-black/[0.04] active:scale-[0.99] transition"
                >
                  <span className="block text-[14px] font-semibold text-[#1d1d1f] tracking-[-0.224px] truncate">
                    {poi.name}
                  </span>
                  <span className="block text-[12px] text-[#86868b] tracking-[-0.12px] truncate">
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
    <div className="space-y-4">
      <LocationField
        label="출발지"
        placeholder="출발지를 검색하세요"
        location={startLocation}
        onSelect={setStartLocation}
      />
      <LocationField
        label="도착지"
        placeholder="도착지를 검색하세요"
        location={endLocation}
        onSelect={setEndLocation}
      />
      <p className="text-[12px] text-[#86868b] tracking-[-0.12px] leading-[1.4]">
        서비스 구역은 강남구 역삼동입니다 (지도의 노란색 경계선).
      </p>
    </div>
  )
}
