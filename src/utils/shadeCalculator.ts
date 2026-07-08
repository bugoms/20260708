import type { ShadeInfo, SunPosition } from '@/types/route'

export function calculateSunPosition(
  latitude: number,
  longitude: number,
  date: Date = new Date()
): SunPosition {
  const J2000 = 2451545.0
  const jd = getJulianDate(date)
  const n = jd - J2000

  const meanSolarTime = (getHours(date) + longitude / 15) / 24
  const solarMeanAnomaly = (357.52911 + 0.98560028 * n) % 360
  const eccentricityEarthOrbit = 0.016708634 - 0.000042037 * n / 36525
  const sunEqOfCenter =
    (1.914602 - 0.004817 * n / 36525) * Math.sin(toRad(solarMeanAnomaly)) +
    (0.019993 - 0.000101 * n / 36525) * Math.sin(toRad(solarMeanAnomaly * 2))

  const sunTrueLongitude = 280.46646 + 0.9856474 * n + sunEqOfCenter
  const sunApparentLongitude =
    sunTrueLongitude -
    0.00569 -
    0.00478 * Math.sin(toRad(125.04 - 1.72846 * n / 36525))

  const obliquityCorrection = getObliquityCorrection(n)
  const sunRightAscension = Math.atan2(
    Math.cos(toRad(obliquityCorrection)) * Math.sin(toRad(sunApparentLongitude)),
    Math.cos(toRad(sunApparentLongitude))
  )

  const sunDeclination = Math.asin(
    Math.sin(toRad(obliquityCorrection)) * Math.sin(toRad(sunApparentLongitude))
  )

  const hourAngle =
    getHourAngle(meanSolarTime) -
    toDeg(sunRightAscension) +
    getEquationOfTime(n, eccentricityEarthOrbit, solarMeanAnomaly)

  const altitude = Math.asin(
    Math.sin(toRad(latitude)) * Math.sin(sunDeclination) +
      Math.cos(toRad(latitude)) *
        Math.cos(sunDeclination) *
        Math.cos(toRad(hourAngle))
  )

  const azimuth = Math.atan2(
    Math.sin(toRad(hourAngle)),
    Math.cos(toRad(hourAngle)) * Math.sin(toRad(latitude)) -
      Math.tan(sunDeclination) * Math.cos(toRad(latitude))
  )

  return {
    azimuth: (toDeg(azimuth) + 180) % 360,
    altitude: toDeg(altitude),
  }
}

export function calculateShadeScore(
  buildingShadow: number,
  treesDensity: number,
  pavingMaterial: number,
  altitude: number
): number {
  const timeWeight = Math.max(0, Math.min(100, altitude + 90))

  const score =
    buildingShadow * 0.4 +
    treesDensity * 0.35 +
    pavingMaterial * 0.15 +
    timeWeight * 0.1

  return Math.round(Math.max(0, Math.min(100, score)))
}

export function estimateShadeAtPoint(
  latitude: number,
  longitude: number,
  sunPosition: SunPosition,
  buildingData: { height: number; distance: number }[] = []
): ShadeInfo {
  let buildingShadow = 0

  if (buildingData.length > 0) {
    const totalScore = buildingData.reduce((sum, building) => {
      const sunAltitudeRad = (sunPosition.altitude * Math.PI) / 180
      if (sunAltitudeRad <= 0) return sum + 100

      const shadowLength = building.height / Math.tan(sunAltitudeRad)
      const shadowCoverage = Math.max(
        0,
        1 - building.distance / Math.max(1, shadowLength)
      )

      return sum + shadowCoverage
    }, 0)

    buildingShadow = Math.min(100, (totalScore / buildingData.length) * 100)
  }

  const treesDensity = 30
  const pavingMaterial = 20
  const totalScore = calculateShadeScore(
    buildingShadow,
    treesDensity,
    pavingMaterial,
    sunPosition.altitude
  )

  return {
    latitude,
    longitude,
    buildingShadow,
    treesDensity,
    pavingMaterial,
    timeWeight: Math.max(0, Math.min(100, sunPosition.altitude + 90)),
    totalScore,
  }
}

function getJulianDate(date: Date): number {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60

  const a = Math.floor((14 - month) / 12)
  const y = year + 4800 - a
  const m = month + 12 * a - 3

  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045 +
    hours / 24
  )
}

function getObliquityCorrection(n: number): number {
  const meanObliquity = 23.439291 - 0.0130042 * n / 36525
  const lambda = 280.46646 + 0.9856474 * n
  const omega = 125.04 - 1.72846 * n / 36525
  const correction =
    0.00256 * Math.cos(toRad(omega)) + 0.00020 * Math.sin(toRad(omega))

  return meanObliquity + correction
}

function getHourAngle(meanSolarTime: number): number {
  const hour = (meanSolarTime * 24) % 24
  return (hour - 12) * 15
}

function getEquationOfTime(
  n: number,
  ecc: number,
  solarMeanAnomaly: number
): number {
  const l0 = 280.46646 + 0.9856474 * n
  const e = ecc
  const m = (357.52911 + 0.98560028 * n) % 360
  const mRad = toRad(m)

  const y = Math.tan(toRad((l0 % 360) / 2))
  const y2 = y * y

  const time =
    2 * toDeg(Math.atan2(y, Math.cos(mRad)) - Math.atan2(y, 1)) +
    (102.9372 - 0.9856474 * n) -
    m

  return time * 4
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function toDeg(radians: number): number {
  return (radians * 180) / Math.PI
}

function getHours(date: Date): number {
  return date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
}
