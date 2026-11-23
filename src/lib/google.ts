import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import { useEffect, useReducer } from 'react'
import { boundsOf, type LatLng, type PlaceResult } from './geo'

/**
 * 구글 지도·장소 API
 * - .env.local 에 VITE_GOOGLE_MAPS_API_KEY 가 있으면 사용, 없으면 앱은 무료 지도/검색으로 동작
 * - 키가 틀렸거나 API가 꺼져 있으면 구글이 gm_authFailure 를 불러준다 → 무료 지도로 자동 전환
 */

const KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
export const GOOGLE_MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID || 'DEMO_MAP_ID'

let failed = false
let configured = false
const listeners = new Set<() => void>()

export const googleEnabled = () => Boolean(KEY) && !failed

export function markGoogleFailed() {
  if (failed) return
  failed = true
  listeners.forEach((fn) => fn())
}

/** 구글 사용 가능 여부가 바뀌면 다시 그리기 */
export function useGoogleEnabled(): boolean {
  const [, rerender] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    listeners.add(rerender)
    return () => {
      listeners.delete(rerender)
    }
  }, [])
  return googleEnabled()
}

export async function gmaps<K extends keyof google.maps.ImportLibraryMap>(name: K): Promise<google.maps.ImportLibraryMap[K]> {
  if (!KEY || failed) throw new Error('구글 지도를 쓸 수 없어요')
  if (!configured) {
    configured = true
    // 지도 글자는 한국어, 국경·지명 표기는 한국 기준
    setOptions({ key: KEY, v: 'weekly', language: 'ko', region: 'KR' })
    ;(window as unknown as { gm_authFailure?: () => void }).gm_authFailure = markGoogleFailed
  }
  try {
    return await importLibrary(name)
  } catch (e) {
    markGoogleFailed()
    throw e
  }
}

/* ───────── 장소 검색 (입력하는 동안 자동완성) ───────── */

export interface GoogleSuggestion {
  placeId: string
  main: string
  secondary: string
  prediction: google.maps.places.PlacePrediction
}

export async function newSearchSession(): Promise<google.maps.places.AutocompleteSessionToken> {
  const { AutocompleteSessionToken } = await gmaps('places')
  return new AutocompleteSessionToken()
}

export async function googleSuggest(
  input: string,
  sessionToken: google.maps.places.AutocompleteSessionToken,
  near: LatLng[],
): Promise<GoogleSuggestion[]> {
  const { AutocompleteSuggestion } = await gmaps('places')
  const request: google.maps.places.AutocompleteRequest = {
    input,
    sessionToken,
    language: 'ko',
    includedRegionCodes: ['jp'],
  }
  // 이미 넣은 장소 근처 결과를 먼저
  if (near.length) request.locationBias = boundsOf(near, 0.15)
  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request)
  return suggestions.flatMap((s) => {
    const p = s.placePrediction
    return p ? [{ placeId: p.placeId, main: p.mainText?.text ?? p.text.text, secondary: p.secondaryText?.text ?? '', prediction: p }] : []
  })
}

/**
 * 한국어 주소에서 "구, 시"만 뽑기: "일본 아이치현 나고야시 나카구 혼마루 1−1" → "나카구, 나고야시"
 * (도쿄처럼 시가 없으면 "시부야구, 도쿄도")
 */
export function areaFromKoAddress(text: string): string {
  const words = text.split(/[\s,]+/).filter((w) => w && w !== '일본')
  const ward = words.find((w) => /.구$/.test(w))
  const city = words.find((w) => /.시$/.test(w)) ?? (ward ? words.find((w) => /.(도|부|현)$/.test(w)) : undefined)
  return [ward, city].filter(Boolean).join(', ')
}

/** 고른 후보의 위치·종류·동네를 가져온다 (검색 세션은 여기서 끝남) */
export async function googleResolve(s: GoogleSuggestion): Promise<PlaceResult> {
  const place = s.prediction.toPlace()
  await place.fetchFields({ fields: ['id', 'displayName', 'location', 'primaryTypeDisplayName', 'addressComponents'] })
  const loc = place.location
  if (!loc) throw new Error('위치를 가져오지 못했어요')
  const comps = place.addressComponents ?? []
  const pick = (type: string) => comps.find((c) => c.types.includes(type))?.longText ?? ''
  const district = pick('sublocality_level_1') || pick('ward')
  const city = pick('locality')
  const name = place.displayName || s.main
  return {
    key: place.id,
    placeId: place.id,
    name,
    localName: name,
    lat: loc.lat(),
    lng: loc.lng(),
    kind: place.primaryTypeDisplayName ?? '',
    // 구글 상세의 주소 조각은 일본 주소를 한국어로 안 줘서(Naka Ward) 자동완성 후보의 한국어 주소를 먼저 쓴다
    area:
      areaFromKoAddress(s.secondary) ||
      [district, city].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', '),
  }
}

/* ───────── 장소 상세 (평점·영업시간·전화) ─────────
 * 사진은 일부러 안 불러온다: 사진은 한 장 보여줄 때마다 따로 요금이 매겨지는 항목(월 무료 1,000건)이라
 * 상세를 열 때마다 한도를 쓴다. 아래 정보는 장소 하나당 한 번만 요청하고 앱이 켜져 있는 동안 다시 쓴다.
 */

export interface PlaceInfo {
  rating: number | null
  ratingCount: number | null
  hours: string[] // 월요일부터 7줄
  address: string
  website: string
  phone: string
}

const infoCache = new Map<string, Promise<PlaceInfo>>()

export function googlePlaceInfo(placeId: string): Promise<PlaceInfo> {
  const cached = infoCache.get(placeId)
  if (cached) return cached
  const job = (async () => {
    const { Place } = await gmaps('places')
    const place = new Place({ id: placeId, requestedLanguage: 'ko' })
    await place.fetchFields({
      fields: ['rating', 'userRatingCount', 'regularOpeningHours', 'formattedAddress', 'websiteURI', 'nationalPhoneNumber'],
    })
    return {
      rating: place.rating ?? null,
      ratingCount: place.userRatingCount ?? null,
      hours: place.regularOpeningHours?.weekdayDescriptions ?? [],
      address: place.formattedAddress ?? '',
      website: place.websiteURI ?? '',
      phone: place.nationalPhoneNumber ?? '',
    }
  })()
  infoCache.set(placeId, job)
  job.catch(() => infoCache.delete(placeId))
  return job
}
