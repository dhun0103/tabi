import { Component, type ReactNode } from 'react'
import { googleEnabled, markGoogleFailed, useGoogleEnabled } from '../../lib/google'
import { GoogleMap } from './GoogleMap'
import { LeafletMap } from './LeafletMap'
import type { MapProps } from './mapTypes'

export type { MapPin, MapRoute } from './mapTypes'

/** 구글 키가 있으면 구글 지도(한국어 지명), 없거나 실패하면 무료 지도 */
export function MapView(props: MapProps) {
  const google = useGoogleEnabled()
  return (
    <MapBoundary className={props.className}>
      {google ? <GoogleMap key="google" {...props} /> : <LeafletMap key="leaflet" {...props} />}
    </MapBoundary>
  )
}

/**
 * 지도에서 오류가 나도 지도 칸만 영향 (일정 목록은 그대로)
 *   구글 지도에서 난 오류 → 무료 지도로 바꿈. 한 번은 다시 그려 보고, 또 오류면 안내 문구
 */
class MapBoundary extends Component<{ className?: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  private retried = false

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    console.error('지도 오류', error)
    if (googleEnabled()) markGoogleFailed()
    if (!this.retried) {
      this.retried = true
      this.setState({ failed: false })
    }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className={`flex items-center justify-center text-[13px] text-neutral-500 ${this.props.className ?? ''}`}>
        지도를 불러오지 못했어요
      </div>
    )
  }
}
