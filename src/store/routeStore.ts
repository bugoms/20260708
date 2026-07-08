import { create } from 'zustand'
import type { Location, RouteResponse, RouteType } from '@/types/route'

interface RouteStore {
  startLocation: Location | null
  endLocation: Location | null
  selectedRoute: RouteType
  optimalRoute: RouteResponse | null
  shadeRoute: RouteResponse | null
  isLoading: boolean
  error: string | null
  currentTime: number

  setStartLocation: (location: Location | null) => void
  setEndLocation: (location: Location | null) => void
  setSelectedRoute: (route: RouteType) => void
  setOptimalRoute: (route: RouteResponse | null) => void
  setShadeRoute: (route: RouteResponse | null) => void
  setIsLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setCurrentTime: (time: number) => void
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
  reset: () => set(initialState),
}))
