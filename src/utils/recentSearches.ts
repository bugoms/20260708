// 최근 검색(출발→도착) 기록 - localStorage 저장

import type { Location } from '@/types/route'

export interface RecentSearch {
  start: Location
  end: Location
  ts: number
}

const STORAGE_KEY = 'recent-searches'
const MAX_ITEMS = 5

export function loadRecentSearches(): RecentSearch[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RecentSearch[]
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ITEMS) : []
  } catch {
    return []
  }
}

export function saveRecentSearch(start: Location, end: Location): RecentSearch[] {
  const current = loadRecentSearches()
  // 같은 출발-도착 쌍은 최신으로 갱신 (중복 제거)
  const filtered = current.filter(
    (item) => !(item.start.name === start.name && item.end.name === end.name)
  )
  const updated = [{ start, end, ts: Date.now() }, ...filtered].slice(
    0,
    MAX_ITEMS
  )
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // 저장 실패(용량 등)는 무시 - 기록은 편의 기능
  }
  return updated
}

export function clearRecentSearches(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
