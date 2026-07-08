import { create } from 'zustand'
import type { Location, RouteResponse, RouteType } from '@/types/route'
import type { RecentSearch } from '@/utils/recentSearches'

interface RouteStore {
  startLocation: Location | null
  endLocation: Location | null
  selectedRoute: RouteType
  optimalRoute: RouteResponse | null
  shadeRoute: RouteResponse | null
  isLoading: boolean
  error: string | null
  currentTime: number
  boundary: Array<Array<[number, number]>> | null // 역삼동 경계 링들 [lng,lat][][]
  recentSearches: RecentSearch[]
  areaAlert: string | null // 서비스 구역 이탈 경고창 메시지

  setStartLocation: (location: Location | null) => void
  setEndLocation: (location: Location | null) => void
  setSelectedRoute: (route: RouteType) => void
  setOptimalRoute: (route: RouteResponse | null) => void
  setShadeRoute: (route: RouteResponse | null) => void
  setIsLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setCurrentTime: (time: number) => void
  setBoundary: (boundary: Array<Array<[number, number]>> | null) => void
  setRecentSearches: (searches: RecentSearch[]) => void
  setAreaAlert: (message: string | null) => void
  reset: () => void
}

const initialState = {
  startLocation: null,
  endLocation: null,
  selectedRoute: 'optimal' as const,
  optimalRoute: null,
  shadeRoute: null,
  isLoading: false,
  error: null,
  currentTime: Date.now(),
  boundary: null,
  recentSearches: [],
  areaAlert: null,
}

export const useRouteStore = create<RouteStore>((set) => ({
  ...initialState,
  setStartLocation: (location) => set({ startLocation: location }),
  setEndLocation: (location) => set({ endLocation: location }),
  setSelectedRoute: (route) => set({ selectedRoute: route }),
  setOptimalRoute: (route) => set({ optimalRoute: route }),
  setShadeRoute: (route) => set({ shadeRoute: route }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setBoundary: (boundary) => set({ boundary }),
  setRecentSearches: (searches) => set({ recentSearches: searches }),
  setAreaAlert: (message) => set({ areaAlert: message }),
  // 경계/최근검색은 정적·영속 데이터이므로 reset해도 유지
  reset: () =>
    set((state) => ({
      ...initialState,
      boundary: state.boundary,
      recentSearches: state.recentSearches,
    })),
}))
