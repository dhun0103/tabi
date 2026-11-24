import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { JAPAN, drawKeyOf, pinElement, type MapPin, type MapProps } from './mapTypes'

/* 구글 키가 없을 때 쓰는 무료 지도: 일본 국토지리원 "연한 지도"(淡色地図). 출처 표시 필수, 일본 전용 */
const TILE_URL = 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'
const ATTRIBUTION = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>'

const icon = (p: MapPin, active: boolean) =>
  L.divIcon({ className: 'tn-pin-wrap', html: pinElement(p, active).outerHTML, iconSize: [28, 28], iconAnchor: [14, 14] })

export function LeafletMap(props: MapProps) {
  const el = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const markersRef = useRef(new Map<string, { marker: L.Marker; pin: MapPin }>())
  const viewSet = useRef(false) // keepView: 화면을 한 번 맞췄나
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
    const { pins, routes = [], fallbackCenter, activeId } = latest.current

    for (const r of routes) {
      if (r.points.length < 2) continue
      L.polyline(
        r.points.map((p) => [p.lat, p.lng] as L.LatLngTuple),
        { color: r.color, weight: 3, opacity: 0.85, dashArray: '1 7', lineCap: 'round', interactive: false },
      ).addTo(layer)
    }
    for (const p of pins) {
      const marker = L.marker([p.lat, p.lng], { icon: icon(p, p.id === activeId), title: p.title, riseOnHover: true })
        .on('click', () => latest.current.onPinClick?.(p.id))
        .addTo(layer)
      markersRef.current.set(p.id, { marker, pin: p })
    }

    if (latest.current.keepView && viewSet.current) return
    viewSet.current = true
    if (pins.length === 1) map.setView([pins[0].lat, pins[0].lng], 15)
    else if (pins.length > 1)
      map.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng] as L.LatLngTuple)), { padding: [36, 36], maxZoom: 16 })
    else if (fallbackCenter) map.setView([fallbackCenter.lat, fallbackCenter.lng], 12)
    else map.setView([JAPAN.center.lat, JAPAN.center.lng], JAPAN.zoom)
  }, [drawKey])

  const { activeId } = props
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const [id, { marker, pin }] of markersRef.current) {
      marker.setIcon(icon(pin, id === activeId))
      marker.setZIndexOffset(id === activeId ? 1000 : 0)
    }
    const hit = activeId ? markersRef.current.get(activeId) : undefined
    if (hit) map.panTo([hit.pin.lat, hit.pin.lng], { animate: true })
  }, [activeId])

  // isolate: 지도 안쪽 z-index가 위의 헤더·탭바를 덮지 않게
  return <div ref={el} className={`isolate ${props.className ?? ''}`} />
}
