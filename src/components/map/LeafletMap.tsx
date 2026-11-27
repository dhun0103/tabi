import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { FOCUS_ZOOM, JAPAN, drawKeyOf, pinElement, type MapFocus, type MapPin, type MapProps } from './mapTypes'

/* 구글 키가 없을 때 쓰는 무료 지도: 일본 국토지리원 "연한 지도"(淡色地図). 출처 표시 필수, 일본 전용 */
const TILE_URL = 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'
const ATTRIBUTION = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>'

const icon = (p: MapPin, active: boolean) => {
  const s = p.small ? 14 : 28 // 들를 곳은 작은 점 (index.css .tn-pin-sm 과 같은 크기)
  return L.divIcon({ className: 'tn-pin-wrap', html: pinElement(p, active).outerHTML, iconSize: [s, s], iconAnchor: [s / 2, s / 2] })
}

export function LeafletMap(props: MapProps) {
  const el = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const markersRef = useRef(new Map<string, { marker: L.Marker; pin: MapPin }>())
  const viewSet = useRef(false) // keepView: 화면을 한 번 맞췄나
  const appliedFocus = useRef<number | null>(null) // 마지막으로 맞춘 focus.key
  const latest = useRef(props)
  useEffect(() => {
    latest.current = props
  })

  useEffect(() => {
    const map = L.map(el.current!, { zoomControl: false, attributionControl: true, minZoom: 5, maxZoom: 19 })
    map.attributionControl.setPrefix(false)
    L.tileLayer(TILE_URL, { minZoom: 5, maxNativeZoom: 18, maxZoom: 19, attribution: ATTRIBUTION }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    map.on('click', (e: L.LeafletMouseEvent) => latest.current.onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }))
    map.setView([JAPAN.center.lat, JAPAN.center.lng], JAPAN.zoom)
    mapRef.current = map
    viewSet.current = false // 지도를 새로 만들었으니 첫 그리기 때 다시 맞춤
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(el.current!)
    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
      layerRef.current = null
      markersRef.current.clear()
    }
  }, [])

  const drawKey = drawKeyOf(props)
  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    markersRef.current.clear()
    const { pins, routes = [], activeId } = latest.current

    for (const r of routes) {
      if (r.points.length < 2) continue
      L.polyline(
        r.points.map((p) => [p.lat, p.lng] as L.LatLngTuple),
        { color: r.color, weight: 3, opacity: 0.85, dashArray: '1 7', lineCap: 'round', interactive: false },
      ).addTo(layer)
    }
    for (const p of pins) {
      const marker = L.marker([p.lat, p.lng], {
        icon: icon(p, p.id === activeId),
        title: p.title,
        riseOnHover: true,
        zIndexOffset: p.id === activeId ? 1000 : 0,
      })
        .on('click', () => latest.current.onPinClick?.(p.id))
        .addTo(layer)
      markersRef.current.set(p.id, { marker, pin: p })
    }

    if (latest.current.keepView && viewSet.current) return
    viewSet.current = true
    // 장소를 고른 채로 다시 그리면(시간을 고쳐 번호가 바뀜, 일행이 장소를 추가·삭제) 하루 전체로 튀지 않고 그 장소 그대로
    const hit = activeId ? pins.find((p) => p.id === activeId) : undefined
    if (hit) focusOn(map, hit)
    else fitAll(map)
  }, [drawKey])

  /** 하루 전체가 보이게: 핀이 여러 개면 다 보이게, 하나면 그 핀, 없으면 기본 위치 */
  function fitAll(map: L.Map) {
    const { pins, fallbackCenter } = latest.current
    if (pins.length === 1) map.setView([pins[0].lat, pins[0].lng], 15)
    else if (pins.length > 1)
      map.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng] as L.LatLngTuple)), { padding: [36, 36], maxZoom: 16 })
    else if (fallbackCenter) map.setView([fallbackCenter.lat, fallbackCenter.lng], 12)
    else map.setView([JAPAN.center.lat, JAPAN.center.lng], JAPAN.zoom)
  }

  /** 고른 장소로 이동. 하루 동선이 넓게 퍼져서 멀리 보고 있으면 동네가 보이게 조금 확대 (NOL처럼) */
  function focusOn(map: L.Map, pin: MapPin) {
    map.setView([pin.lat, pin.lng], Math.max(map.getZoom(), FOCUS_ZOOM), { animate: true })
  }

  /** 들를 곳: 점들이 다 보이게 (점 하나면 그 점을 가운데에 f.zoom 으로) */
  function fitPoints(map: L.Map, f: MapFocus) {
    if (f.points.length === 1) map.setView([f.points[0].lat, f.points[0].lng], f.zoom, { animate: true })
    else map.fitBounds(L.latLngBounds(f.points.map((p) => [p.lat, p.lng] as L.LatLngTuple)), { padding: [40, 40], maxZoom: f.zoom })
  }

  // 고른 장소가 바뀌면 그 핀을 크게 + 지도 이동. 고른 게 풀리면(목록 맨 위로) 하루 전체 보기로
  const { activeId } = props
  const prevActive = useRef<string | null | undefined>(null)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const [id, { marker, pin }] of markersRef.current) {
      marker.setIcon(icon(pin, id === activeId))
      marker.setZIndexOffset(id === activeId ? 1000 : 0)
    }
    const hit = activeId ? markersRef.current.get(activeId) : undefined
    if (hit) focusOn(map, hit.pin)
    else if (!activeId && prevActive.current) fitAll(map)
    prevActive.current = activeId
  }, [activeId])

  // 들를 곳을 펼치거나 누르면 그 동네·점으로
  // 무료 지도는 그리기·고른 장소 이동이 모두 바로(같은 순간에) 끝나서, 맨 마지막 이 effect가 화면을 정함
  const focusKey = props.focus?.key
  useEffect(() => {
    const map = mapRef.current
    const f = latest.current.focus
    if (!map || !f || !f.points.length || f.key === appliedFocus.current) return
    appliedFocus.current = f.key
    fitPoints(map, f)
  }, [focusKey])

  // isolate: 지도 안쪽 z-index가 위의 헤더·탭바를 덮지 않게
  return <div ref={el} className={`isolate ${props.className ?? ''}`} />
}
