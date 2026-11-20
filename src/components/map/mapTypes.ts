import type { LatLng } from '../../lib/geo'

export interface MapPin extends LatLng {
  id: string
  label: string // 핀 안 숫자
  title: string // 마우스 올렸을 때 / 스크린리더
  color: string
  ink: string
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
  className?: string
}

export const JAPAN = { center: { lat: 36.2, lng: 138.25 }, zoom: 5 }

/** 핀·동선이 바뀌었을 때만 다시 그리기 위한 키 */
export const drawKeyOf = (p: MapProps) =>
  JSON.stringify([p.pins.map((x) => [x.id, x.lat, x.lng, x.label, x.color]), p.routes?.map((r) => [r.color, r.points]), p.fallbackCenter])

export function pinElement(p: MapPin, active: boolean): HTMLDivElement {
  const el = document.createElement('div')
  el.className = `tn-pin${active ? ' is-active' : ''}`
  el.style.background = p.color
  el.style.color = p.ink
  el.textContent = p.label
  return el
}
