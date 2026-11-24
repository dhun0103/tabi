import { useEffect, useRef, useState } from 'react'
import { GOOGLE_MAP_ID, gmaps } from '../../lib/google'
import { FOCUS_ZOOM, JAPAN, drawKeyOf, pinElement, type MapPin, type MapProps } from './mapTypes'

interface MarkerEntry {
  marker: google.maps.marker.AdvancedMarkerElement
  pin: MapPin
  wrap: HTMLDivElement
}

/** 구글 지도 (한국어 지명). 번호 핀 = AdvancedMarker, 동선 = 점선 Polyline */
export function GoogleMap(props: MapProps) {
  const el = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef(new Map<string, MarkerEntry>())
  const linesRef = useRef<google.maps.Polyline[]>([])
  const viewSet = useRef(false) // keepView: 화면을 한 번 맞췄나
  const [ready, setReady] = useState(false)
  const latest = useRef(props)
  useEffect(() => {
    latest.current = props
  })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { Map } = await gmaps('maps')
      if (cancelled || !el.current) return
      const map = new Map(el.current, {
        center: JAPAN.center,
        zoom: JAPAN.zoom,
        mapId: GOOGLE_MAP_ID,
        disableDefaultUI: true,
        clickableIcons: false,
        gestureHandling: 'greedy',
        keyboardShortcuts: false,
      })
      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) latest.current.onMapClick?.({ lat: e.latLng.lat(), lng: e.latLng.lng() })
      })
      mapRef.current = map
      viewSet.current = false // 지도를 새로 만들었으니 첫 그리기 때 다시 맞춤
      setReady(true)
    })().catch(() => {
      /* gmaps() 가 실패를 알리면 MapView 가 무료 지도로 바꾼다 */
    })
    return () => {
      cancelled = true
      // 키 오류(gm_authFailure)로 구글이 멈춘 뒤엔 핀을 떼다가 구글 쪽에서 오류가 남
      // → 무시 (안 그러면 오류가 화면 전체로 번져 앱이 하얗게 됨)
      try {
        for (const { marker } of markersRef.current.values()) marker.map = null
        for (const line of linesRef.current) line.setMap(null)
      } catch {
        /* 무료 지도로 바뀌는 중이라 정리 실패는 상관없음 */
      }
      markersRef.current.clear()
      linesRef.current = []
      mapRef.current = null
    }
  }, [])

  const drawKey = drawKeyOf(props)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    let cancelled = false
    void (async () => {
      const [{ AdvancedMarkerElement }, { Polyline }, { event }] = await Promise.all([gmaps('marker'), gmaps('maps'), gmaps('core')])
      if (cancelled) return
      for (const { marker } of markersRef.current.values()) marker.map = null
      markersRef.current.clear()
      for (const line of linesRef.current) line.setMap(null)
      linesRef.current = []

      const { pins, routes = [], activeId } = latest.current
      for (const r of routes) {
        if (r.points.length < 2) continue
        linesRef.current.push(
          new Polyline({
            map,
            path: r.points,
            strokeOpacity: 0,
            clickable: false,
            icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.9, strokeColor: r.color, strokeWeight: 3, scale: 1.5 }, offset: '0', repeat: '9px' }],
          }),
        )
      }
      for (const p of pins) {
        // 동그란 핀의 가운데가 좌표에 오도록 반 칸 내림 (마커 기준점은 아래쪽 가운데)
        const wrap = document.createElement('div')
        wrap.style.transform = 'translateY(50%)'
        wrap.appendChild(pinElement(p, p.id === activeId))
        const marker = new AdvancedMarkerElement({ map, position: p, content: wrap, title: p.title, gmpClickable: true })
        marker.addEventListener('gmp-click', () => latest.current.onPinClick?.(p.id))
        markersRef.current.set(p.id, { marker, pin: p, wrap })
      }

      if (latest.current.keepView && viewSet.current) return
      viewSet.current = true
      fitAll(map, event)
    })().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [drawKey, ready])

  /** 하루 전체가 보이게: 핀이 여러 개면 다 보이게, 하나면 그 핀, 없으면 기본 위치 */
  function fitAll(map: google.maps.Map, event: typeof google.maps.event) {
    const { pins, fallbackCenter } = latest.current
    if (pins.length === 1) {
      map.setCenter(pins[0])
      map.setZoom(15)
    } else if (pins.length > 1) {
      const lats = pins.map((p) => p.lat)
      const lngs = pins.map((p) => p.lng)
      map.fitBounds({ north: Math.max(...lats), south: Math.min(...lats), east: Math.max(...lngs), west: Math.min(...lngs) }, 48)
      event.addListenerOnce(map, 'idle', () => {
        if ((map.getZoom() ?? 0) > 16) map.setZoom(16)
      })
    } else if (fallbackCenter) {
      map.setCenter(fallbackCenter)
      map.setZoom(12)
    } else {
      map.setCenter(JAPAN.center)
      map.setZoom(JAPAN.zoom)
    }
  }

  // 고른 장소가 바뀌면 그 핀을 크게 + 지도 이동. 고른 게 풀리면(목록 맨 위로) 하루 전체 보기로
  const { activeId } = props
  const prevActive = useRef<string | null | undefined>(null)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const [id, { marker, pin, wrap }] of markersRef.current) {
      wrap.replaceChildren(pinElement(pin, id === activeId))
      marker.zIndex = id === activeId ? 1000 : null
    }
    const hit = activeId ? markersRef.current.get(activeId) : undefined
    if (hit) {
      // 하루 동선이 넓게 퍼져서 멀리 보고 있으면 동네가 보이게 조금 확대 (NOL처럼)
      if ((map.getZoom() ?? 0) < FOCUS_ZOOM) map.setZoom(FOCUS_ZOOM)
      map.panTo(hit.pin)
    } else if (!activeId && prevActive.current) {
      gmaps('core')
        .then(({ event }) => mapRef.current === map && fitAll(map, event))
        .catch(() => {})
    }
    prevActive.current = activeId
  }, [activeId])

  return <div ref={el} className={props.className} />
}
