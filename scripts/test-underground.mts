// 지하보도 라우팅 검증 스크립트 — 선릉역 케이스
// 실행: npx tsx scripts/test-underground.mts
// 한낮(태양 고도 최고) 테헤란로 선릉역 통과 구간에서
// 그늘 경로가 지하보도를 실제로 꿰어가는지 확인한다.

import { fetchWalkData } from '../src/utils/overpass'
import { routeWithShade } from '../src/utils/osmRouter'
import { scoreRoute } from '../src/utils/shadeScoring'
import { undergroundNetworksOnPath } from '../src/utils/underground'
import { bboxWithMargin, distanceMeters, samplePath } from '../src/utils/geo'
import {
  isInYeoksam,
  distanceToYeoksamBoundary,
} from '../src/utils/serviceArea'
import undergroundData from '../src/data/underground.json'

// ---------- 0) 정적 데이터 정합성 (3개 역 모두) ----------
for (const network of undergroundData.networks) {
  const byId = new Map(network.nodes.map((n) => [n.id, n]))
  for (const [a, b] of network.edges) {
    const na = byId.get(a)
    const nb = byId.get(b)
    if (!na || !nb) throw new Error(`${network.id}: 엣지 [${a},${b}]가 없는 노드를 참조`)
    const len = distanceMeters(
      { lat: na.lat, lng: na.lng },
      { lat: nb.lat, lng: nb.lng }
    )
    if (len === 0 || len > 200)
      throw new Error(`${network.id}: 엣지 [${a},${b}] 길이 이상 (${Math.round(len)}m)`)
  }
  // 연결성: 모든 노드가 첫 노드에서 도달 가능해야 함
  const adj = new Map<string, string[]>()
  for (const [a, b] of network.edges) {
    adj.set(a, [...(adj.get(a) ?? []), b])
    adj.set(b, [...(adj.get(b) ?? []), a])
  }
  const seen = new Set([network.nodes[0].id])
  const queue = [network.nodes[0].id]
  while (queue.length > 0) {
    for (const next of adj.get(queue.pop()!) ?? []) {
      if (!seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }
  if (seen.size !== network.nodes.length)
    throw new Error(`${network.id}: 고립된 지하 노드 존재 (${seen.size}/${network.nodes.length})`)
}
console.log(`정적 데이터 OK: ${undergroundData.networks.map((n) => n.name).join(', ')}`)

// 선릉역 바로 앞에서 테헤란로 반대편으로 건너는 케이스:
// 지상은 횡단보도까지 우회 + 햇빛 노출, 지하보도가 명확히 유리
const start = { lat: 37.504, lng: 127.0481 } // 테헤란로 남측 (역 앞)
const end = { lat: 37.5051, lng: 127.0483 } // 테헤란로 북측 (역삼동 내)
const noon = new Date('2026-07-09T13:00:00+09:00')

const bbox = bboxWithMargin([start, end], 400)
const walk = await fetchWalkData(bbox)

const undergroundWays = walk.ways.filter((w) => w.isUnderground).length
const entranceLinks = walk.ways.filter((w) => w.isEntranceLink).length
console.log(
  `그래프: 노드 ${walk.nodes.size} / way ${walk.ways.length}` +
    ` (지하 통로 ${undergroundWays}, 출입구 연결 ${entranceLinks})`
)
if (undergroundWays === 0) throw new Error('지하보도가 주입되지 않았습니다')
if (entranceLinks === 0) throw new Error('출입구가 지상 그래프에 연결되지 않았습니다')

// 실서비스 흐름 재현: 기준(유사 최적) 경로를 먼저 구하고,
// 그 경로에 회피 페널티 1.4를 적용해 그늘 경로 탐색 (shade API와 동일)
const baseline = routeWithShade(walk, start, end, noon, [], 1)
if (!baseline) throw new Error('기준 경로 탐색 실패')
const route = routeWithShade(walk, start, end, noon, baseline.path, 1.4)
if (!route) throw new Error('경로 탐색 실패')

const via = undergroundNetworksOnPath(route.path)
const breakdown = scoreRoute(route.path, walk, noon)
console.log(`한낮 경로: ${route.distance}m, ${route.duration}초`)
console.log(`지하보도 통과: ${via.length > 0 ? via.join(', ') : '없음'}`)
console.log(
  `그늘 점수 ${breakdown.score} (건물그림자 ${breakdown.buildingShadowRatio}%` +
    ` / 공원 ${breakdown.parkRatio}% / 지하 ${breakdown.undergroundRatio}%` +
    ` / 노출 ${breakdown.exposedRatio}%)`
)
if (via.length === 0) {
  console.warn('⚠ 한낮인데 지하보도를 사용하지 않음 - 비용 파라미터 확인 필요')
}

// 지하 통행은 반드시 출입구(entrance)를 통해서만:
// 경로에서 내부(internal) 노드 구간을 찾아 양 끝이 출입구 좌표인지 확인
const nodeTypeByCoord = new Map<string, string>()
for (const nw of undergroundData.networks) {
  for (const nd of nw.nodes) {
    nodeTypeByCoord.set(`${nd.lat.toFixed(7)}:${nd.lng.toFixed(7)}`, nd.type)
  }
}
const types = route.path.map(
  ([lng, lat]) => nodeTypeByCoord.get(`${lat.toFixed(7)}:${lng.toFixed(7)}`) ?? null
)
for (let i = 0; i < types.length; i++) {
  if (types[i] !== 'internal') continue
  let j = i - 1
  while (j >= 0 && types[j] === 'internal') j--
  let k = i + 1
  while (k < types.length && types[k] === 'internal') k++
  if (j < 0 || types[j] !== 'entrance' || k >= types.length || types[k] !== 'entrance') {
    throw new Error(`지하 구간(경로 ${i}번째 지점)이 출입구를 거치지 않고 연결됨`)
  }
}
console.log('출입구 통행 OK: 지하 구간 진출입이 모두 출입구 경유')

// 경로가 역삼동 구역을 벗어나지 않는지 (경계 도로 완충 40m 허용)
const outside = samplePath(route.path, 20).filter(
  (p) => !isInYeoksam(p.lat, p.lng) && distanceToYeoksamBoundary(p) > 40
)
if (outside.length > 0) {
  throw new Error(
    `경로가 역삼동 밖으로 ${outside.length}개 지점 이탈: ` +
      outside
        .slice(0, 3)
        .map((p) => `(${p.lat.toFixed(5)},${p.lng.toFixed(5)})`)
        .join(' ')
  )
}
console.log('구역 확인 OK: 경로가 역삼동 경계(+40m 완충) 안에 머무름')

// 밤에는 그늘 이점 없이 계단 페널티만 남음 (그래도 더 짧으면 쓸 수 있음 - 정상)
const night = new Date('2026-07-09T23:00:00+09:00')
const nightRoute = routeWithShade(walk, start, end, night, [], 1)
if (nightRoute) {
  const nightVia = undergroundNetworksOnPath(nightRoute.path)
  console.log(
    `밤 경로: ${nightRoute.distance}m — 지하보도 ${nightVia.length > 0 ? nightVia.join(', ') + ' 사용' : '미사용'}`
  )
}
