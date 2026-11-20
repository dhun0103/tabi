import { useGoogleEnabled } from '../../lib/google'
import { GoogleMap } from './GoogleMap'
import { LeafletMap } from './LeafletMap'
import type { MapProps } from './mapTypes'

export type { MapPin, MapRoute } from './mapTypes'

/** 구글 키가 있으면 구글 지도(한국어 지명), 없거나 실패하면 무료 지도 */
export function MapView(props: MapProps) {
  const google = useGoogleEnabled()
  return google ? <GoogleMap key="google" {...props} /> : <LeafletMap key="leaflet" {...props} />
}
