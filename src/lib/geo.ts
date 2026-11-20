import type { Plan } from '../types'

/* ───────── 날짜별 색 (지도 핀·동선·타임라인 번호) ─────────
 * dataviz 기본 팔레트 순서 그대로 (색약 구분 검증된 순서). 9일차부터는 회색.
 * ink: 핀 안 숫자 색 (밝은 색 위엔 검정, 어두운 색 위엔 흰색) */
const DAY_COLORS = [
  { bg: '#2a78d6', ink: '#ffffff' }, // blue
  { bg: '#eb6834', ink: '#ffffff' }, // orange
  { bg: '#1baf7a', ink: '#0b0b0b' }, // aqua
  { bg: '#eda100', ink: '#0b0b0b' }, // yellow
  { bg: '#e87ba4', ink: '#0b0b0b' }, // magenta
  { bg: '#008300', ink: '#ffffff' }, // green
  { bg: '#6250d6', ink: '#ffffff' }, // violet
  { bg: '#e34948', ink: '#ffffff' }, // red
]
export const NEUTRAL_COLOR = { bg: '#52514e', ink: '#ffffff' }
export const dayColor = (index: number) => DAY_COLORS[index] ?? NEUTRAL_COLOR

/* ───────── 좌표 ───────── */

export interface LatLng {
  lat: number
  lng: number
}

export const hasCoords = (p: Plan): p is Plan & { lat: number; lng: number } =>
  typeof p.lat === 'number' && typeof p.lng === 'number' && Number.isFinite(p.lat) && Number.isFinite(p.lng)

/** 두 지점 사이 직선거리 (m) */
export function distanceM(a: LatLng, b: LatLng): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function fmtDistance(m: number): string {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)}m`
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)}km`
}

/** 다음 장소까지 대략 얼마나 걸리는지 (직선거리 × 1.3 을 분속 80m로 걸었다고 가정) */
export function travelHint(m: number): string {
  if (m <= 2500) return `${fmtDistance(m)} · 도보 약 ${Math.max(1, Math.round((m * 1.3) / 80))}분`
  return `${fmtDistance(m)} · 대중교통 추천`
}

/** 여러 지점의 가운데 (지도 기본 위치용) */
export function centerOf(points: LatLng[]): LatLng | null {
  if (!points.length) return null
  const b = boundsOf(points, 0)
  return { lat: (b.north + b.south) / 2, lng: (b.east + b.west) / 2 }
}

export function boundsOf(points: LatLng[], pad: number) {
  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  return {
    north: Math.max(...lats) + pad,
    south: Math.min(...lats) - pad,
    east: Math.max(...lngs) + pad,
    west: Math.min(...lngs) - pad,
  }
}

/* ───────── 구글맵 링크 (구글맵 앱 열기) ───────── */

const isUrl = (s: string) => /^https?:\/\//i.test(s.trim())

/** 장소 보기: 구글 장소 ID가 있으면 정확히 그 장소, 없으면 이름/좌표로 */
export function googlePlaceUrl(p: Plan): string | null {
  if (p.placeId) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.place || p.title)}&query_place_id=${encodeURIComponent(p.placeId)}`
  }
  if (p.mapUrl && isUrl(p.mapUrl)) return p.mapUrl
  const q = p.place || (hasCoords(p) ? `${p.lat},${p.lng}` : '')
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null
}

/** 길찾기 (대중교통 기본) */
export function googleDirectionsUrl(p: Plan): string | null {
  const base = 'https://www.google.com/maps/dir/?api=1&travelmode=transit'
  if (p.placeId) {
    return `${base}&destination=${encodeURIComponent(p.place || p.title)}&destination_place_id=${encodeURIComponent(p.placeId)}`
  }
  const dest = hasCoords(p) ? `${p.lat},${p.lng}` : p.place
  return dest ? `${base}&destination=${encodeURIComponent(dest)}` : null
}

/** 두 장소 사이 길찾기 (가까우면 도보, 멀면 대중교통) */
export function googleLegUrl(a: LatLng, b: LatLng): string {
  const mode = distanceM(a, b) <= 1500 ? 'walking' : 'transit'
  return `https://www.google.com/maps/dir/?api=1&origin=${a.lat},${a.lng}&destination=${b.lat},${b.lng}&travelmode=${mode}`
}

/** 하루 동선: 장소들을 순서대로 이은 경로 */
export function googleRouteUrl(plans: Plan[]): string | null {
  const stops = plans
    .filter((p) => p.type === 'place')
    .map((p) => (hasCoords(p) ? `${p.lat},${p.lng}` : p.place))
    .filter(Boolean)
  return stops.length >= 2 ? `https://www.google.com/maps/dir/${stops.map((s) => encodeURIComponent(s)).join('/')}` : null
}

/* ───────── 장소 검색 결과 (구글 / 무료 검색 공통 모양) ───────── */

export interface PlaceResult {
  key: string
  name: string // 화면에 보일 이름 (한국어 이름이 있으면 한국어)
  localName: string // 구글맵 검색어로 쓸 이름
  lat: number
  lng: number
  kind: string
  area: string
  placeId?: string // 구글에서 찾은 장소만
}

/* ───────── 무료 장소 검색 (OpenStreetMap Nominatim) ─────────
 * 구글 키가 없을 때 사용. 이용 규칙: 1초에 1번 이하, 입력할 때마다 자동 검색 금지 */

interface NominatimRow {
  place_id: number
  lat: string
  lon: string
  name?: string
  display_name: string
  category?: string
  type?: string
  namedetails?: Record<string, string>
  address?: Record<string, string>
}

const KIND_BY_TYPE: Record<string, string> = {
  restaurant: '음식점',
  fast_food: '음식점',
  food_court: '음식점',
  cafe: '카페',
  ice_cream: '카페',
  bar: '술집',
  pub: '술집',
  hotel: '숙소',
  hostel: '숙소',
  guest_house: '숙소',
  motel: '숙소',
  apartment: '숙소',
  museum: '박물관',
  gallery: '미술관',
  zoo: '동물원',
  aquarium: '수족관',
  theme_park: '테마파크',
  park: '공원',
  garden: '공원',
  station: '역',
  stop: '역',
  halt: '역',
  aerodrome: '공항',
  place_of_worship: '절·신사',
  shrine: '신사',
  temple: '절',
}

function kindOf(category = '', type = ''): string {
  if (KIND_BY_TYPE[type]) return KIND_BY_TYPE[type]
  if (category === 'shop') return '쇼핑'
  if (category === 'historic' || category === 'tourism') return '관광명소'
  if (category === 'railway' || category === 'public_transport') return '역'
  return ''
}

function areaOf(a: Record<string, string> = {}): string {
  const district = a.city_district || a.suburb || a.quarter || a.town || a.village || ''
  const city = a.city || a.county || ''
  return [district, city].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(', ')
}

export async function searchPlacesFree(query: string, near: LatLng[] = [], signal?: AbortSignal): Promise<PlaceResult[]> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    q: query,
    countrycodes: 'jp',
    'accept-language': 'ko',
    namedetails: '1',
    addressdetails: '1',
    limit: '8',
  })
  // 이미 넣은 장소 근처를 우선 (범위 밖 결과도 나옴)
  if (near.length) {
    const b = boundsOf(near, 0.2)
    params.set('viewbox', [b.west, b.north, b.east, b.south].join(','))
  }
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(res.status === 429 ? '검색이 너무 잦아요. 잠시 뒤 다시 해 주세요' : `검색 실패 (${res.status})`)
  const rows = (await res.json()) as NominatimRow[]
  return rows.map((r) => {
    const first = r.display_name.split(',')[0].trim()
    return {
      key: String(r.place_id),
      name: r.name || first,
      localName: r.namedetails?.name || r.name || first,
      lat: Number(r.lat),
      lng: Number(r.lon),
      kind: kindOf(r.category, r.type),
      area: areaOf(r.address),
    }
  })
}
