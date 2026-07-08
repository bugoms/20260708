'use client'

import { useState } from 'react'
import { SearchBar } from './SearchBar'
import { RouteOptionButtons } from './RouteOptionButtons'
import { RouteDetails } from './RouteDetails'

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:flex flex-col w-[350px] bg-white/90 backdrop-blur-sm shadow-lg overflow-hidden"
        role="complementary"
        aria-label="경로 검색 패널"
      >
        <div className="flex-1 overflow-y-auto p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            🗺️ 길 찾기
          </h1>

          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                경로 검색
              </h2>
              <SearchBar />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                경로 선택
              </h2>
              <RouteOptionButtons />
            </div>

            <RouteDetails />
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Button */}
      <div className="lg:hidden fixed bottom-6 left-6 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-blue-500 text-white rounded-full p-4 shadow-lg hover:bg-blue-600 transition-colors"
          aria-label="패널 열기/닫기"
        >
          {isOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsOpen(false)}
          ></div>
          <aside className="absolute left-0 top-0 bottom-0 w-80 bg-white shadow-lg overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">
                  🗺️ 길 찾기
                </h1>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                  aria-label="패널 닫기"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">
                    경로 검색
                  </h2>
                  <SearchBar />
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">
                    경로 선택
                  </h2>
                  <RouteOptionButtons />
                </div>

                <RouteDetails />
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
