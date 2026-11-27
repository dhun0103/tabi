import type { LatLng } from '../../lib/geo'

export interface MapPin extends LatLng {
  id: string
  label: string // 핀 안 숫자
  title: string // 마우스 올렸을 때 / 스크린리더
  color: string
  ink: string
  small?: boolean // 들를 곳: 숫자 없는 작은 점
}

/** 이 점들이 다 보이게 확대 (key가 바뀔 때마다 한 번). 점이 하나면 그 점을 가운데에 zoom 으로 */
export interface MapFocus {
  key: number
  points: LatLng[]
  zoom: number // 점들을 맞출 때 이보다 더 가까이는 안 감 (점 하나면 이 확대로)
}

export interface MapRoute {
  color: string
  points: LatLng[]
}

/** 구글 지도·무료 지도 공통 props */
export interface MapProps {
  pins: MapPin[]
  routes?: MapRoute[] // 날짜별 동선 (점선)
  activeId?: string | null
  fallbackCenter?: LatLng | null // 핀이 없을 때 보여줄 곳
  onPinClick?: (id: string) => void
  onMapClick?: (pos: LatLng) => void
  // true면 처음 한 번만 화면을 맞추고, 그 뒤엔 핀이 바뀌어도 화면을 안 옮김
  // (지도에서 직접 찍을 때: 누를 때마다 확대가 풀리고 가운데로 튀지 않게)
  keepView?: boolean
  // 들를 곳을 펼치거나 누를 때: 그 동네(점들)가 보이게 확대
  focus?: MapFocus | null
  className?: string
}

export const JAPAN = { center: { lat: 36.2, lng: 138.25 }, zoom: 5 }
/** 목록에서 장소를 고르면 적어도 이만큼은 확대 (시·구 정도가 보이는 크기) */
export const FOCUS_ZOOM = 11

/** 핀·동선이 바뀌었을 때만 다시 그리기 위한 키 */
export const drawKeyOf = (p: MapProps) =>
  JSON.stringify([p.pins.map((x) => [x.id, x.lat, x.lng, x.label, x.color, x.small]), p.routes?.map((r) => [r.color, r.points]), p.fallbackCenter])

export function pinElement(p: MapPin, active: boolean): HTMLDivElement {
  const el = document.createElement('div')
  el.className = `tn-pin${p.small ? ' tn-pin-sm' : ''}${active ? ' is-active' : ''}`
  el.style.background = p.color
  el.style.color = p.ink
  el.textContent = p.label
  return el
}
