'use client'

import { useRouteStore } from '@/store/routeStore'

const TIME_OPTIONS = [
  { value: '09', label: '9시' },
  { value: '12', label: '12시' },
  { value: '15', label: '15시' },
  { value: '18', label: '18시' },
]

export function SunlightControl() {
  const { sunlightTime, setSunlightTime } = useRouteStore()

  return (
    <div>
      <h2 className="text-[14px] font-semibold text-[#1d1d1f] tracking-[-0.224px] mb-2">
        일조량 지도
      </h2>
      <div className="flex gap-1.5">
        <button
          onClick={() => setSunlightTime(null)}
          className={`flex-1 h-[34px] rounded-full text-[13px] tracking-[-0.2px] transition active:scale-95 ${
            sunlightTime === null
              ? 'bg-[#1d1d1f] text-white font-semibold'
              : 'bg-white text-[#1d1d1f] border border-black/[0.08]'
          }`}
          aria-pressed={sunlightTime === null}
        >
          끔
        </button>
        {TIME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSunlightTime(opt.value)}
            className={`flex-1 h-[34px] rounded-full text-[13px] tracking-[-0.2px] transition active:scale-95 ${
              sunlightTime === opt.value
                ? 'bg-[#0066cc] text-white font-semibold'
                : 'bg-white text-[#0066cc] border border-[#0066cc]/40'
            }`}
            aria-pressed={sunlightTime === opt.value}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {sunlightTime && (
        <p className="mt-2 text-[11px] text-[#86868b] tracking-[-0.12px] leading-[1.4]">
          한여름(7월) {sunlightTime}시 기준 시뮬레이션 ·{' '}
          <span className="text-[#c99000]">노랑=햇빛</span> ·{' '}
          <span className="text-[#2c3e70]">남색=건물 그림자</span> ·{' '}
          <span className="text-[#2e7d50]">초록=공원</span>
        </p>
      )}
    </div>
  )
}
