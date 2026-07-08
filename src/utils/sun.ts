// 태양 위치 계산 (suncalc 알고리즘 기반)
// https://github.com/mourner/suncalc — 천문학 공식의 검증된 구현을 이식

import type { SunPosition } from '@/types/route'

const RAD = Math.PI / 180
const DAY_MS = 1000 * 60 * 60 * 24
const J1970 = 2440588
const J2000 = 2451545
const OBLIQUITY = RAD * 23.4397 // 지구 자전축 기울기

function toJulian(date: Date): number {
  return date.valueOf() / DAY_MS - 0.5 + J1970
}

function toDays(date: Date): number {
  return toJulian(date) - J2000
}

function solarMeanAnomaly(d: number): number {
  return RAD * (357.5291 + 0.98560028 * d)
}

function eclipticLongitude(M: number): number {
  const C =
    RAD *
    (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M))
  const P = RAD * 102.9372 // 근일점 황경
  return M + C + P + Math.PI
}

function declination(l: number): number {
  return Math.asin(Math.sin(l) * Math.sin(OBLIQUITY))
}

function rightAscension(l: number): number {
  return Math.atan2(Math.sin(l) * Math.cos(OBLIQUITY), Math.cos(l))
}

function siderealTime(d: number, lw: number): number {
  return RAD * (280.16 + 360.9856235 * d) - lw
}

/**
 * 특정 시각·위치의 태양 고도/방위각 계산
 * @returns altitude: 지평선 기준 고도(도, 밤이면 음수)
 *          azimuth: 북쪽 기준 시계방향 방위각(도, 남=180)
 */
export function getSunPosition(
  date: Date,
  lat: number,
  lng: number
): SunPosition {
  const lw = RAD * -lng
  const phi = RAD * lat
  const d = toDays(date)

  const M = solarMeanAnomaly(d)
  const L = eclipticLongitude(M)
  const dec = declination(L)
  const ra = rightAscension(L)
  const H = siderealTime(d, lw) - ra

  const altitude = Math.asin(
    Math.sin(phi) * Math.sin(dec) +
      Math.cos(phi) * Math.cos(dec) * Math.cos(H)
  )
  // suncalc 방위각은 남쪽 기준이므로 북쪽 기준으로 변환(+180)
  const azimuth =
    Math.atan2(
      Math.sin(H),
      Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)
    ) /
      RAD +
    180

  return {
    altitude: altitude / RAD,
    azimuth: ((azimuth % 360) + 360) % 360,
  }
}
