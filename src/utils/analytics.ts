// Google Analytics(GA4) 이벤트 전송 유틸

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

/** GA4 이벤트 전송 (gtag 미로드 시 조용히 무시) */
export function gaEvent(
  name: string,
  params?: Record<string, string | number | boolean>
): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return
  }
  window.gtag('event', name, params || {})
}
