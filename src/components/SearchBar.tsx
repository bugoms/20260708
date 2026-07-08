'use client'

import { useState, useCallback, useId } from 'react'
import { useRouteStore } from '@/store/routeStore'
import type { Location } from '@/types/route'

export function SearchBar() {
  const { startLocation, endLocation, setStartLocation, setEndLocation } =
    useRouteStore()

  // 인스턴스마다 고유한 id (데스크톱/모바일 SearchBar 중복 id 방지)
  const startId = useId()
  const endId = useId()

  const [startInput, setStartInput] = useState(startLocation?.name || '')
  const [endInput, setEndInput] = useState(endLocation?.name || '')

  const handleStartChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setStartInput(e.target.value)
  }, [])

  const handleEndChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEndInput(e.target.value)
  }, [])

  const handleStartBlur = useCallback(() => {
    if (startInput.trim()) {
      const location: Location = {
        name: startInput,
        lat: 37.4979,
        lng: 127.0276,
      }
      setStartLocation(location)
    }
  }, [startInput, setStartLocation])

  const handleEndBlur = useCallback(() => {
    if (endInput.trim()) {
      const location: Location = {
        name: endInput,
        lat: 37.5,
        lng: 127.03,
      }
      setEndLocation(location)
    }
  }, [endInput, setEndLocation])

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={startId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          출발지
        </label>
        <input
          id={startId}
          type="text"
          placeholder="출발지를 입력하세요"
          value={startInput}
          onChange={handleStartChange}
          onBlur={handleStartBlur}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          aria-label="출발지 입력"
        />
      </div>

      <div>
        <label htmlFor={endId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          도착지
        </label>
        <input
          id={endId}
          type="text"
          placeholder="도착지를 입력하세요"
          value={endInput}
          onChange={handleEndChange}
          onBlur={handleEndBlur}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          aria-label="도착지 입력"
        />
      </div>
    </div>
  )
}
