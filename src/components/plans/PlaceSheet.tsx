import { useEffect, useMemo, useRef, useState } from 'react'
import { areaLabel, centerOf, hasCoords, placeColor, searchPlacesFree, type LatLng, type PlaceResult } from '../../lib/geo'
import { googleResolve, googleSuggest, newSearchSession, useGoogleEnabled, type GoogleSuggestion } from '../../lib/google'
import { orderForInsert } from '../../lib/order'
import { categoryFromKind, changedFields, dayText, kindLabel, newId, suggestTime } from '../../lib/util'
import { repo } from '../../store'
import type { Plan, SubSpot, Trip } from '../../types'
import { askConfirm } from '../ConfirmDialog'
import { MapView } from '../map/MapView'
import { TimePicker } from '../TimePicker'
import { Field, Sheet, btnDanger, btnPrimary, inputCls, reportError } from '../ui'

interface Spot extends LatLng {
  name: string
  localName: string
  kind: string
  area: string
  placeId: string
}

interface Props {
  trip: Trip
  days: string[]
  allPlans: Plan[]
  initial: Plan | null
  defaultDate: string
  /** 들를 곳 모드: 이 장소 안에 들를 곳을 추가 (시간 칸 없음, 저장하면 onAddSpot) */
  spotOf?: Plan | null
  onAddSpot?: (spot: SubSpot, from: Plan | null) => void
  onClose: () => void
}

/** 이 여행에 이미 넣은 장소 하나 (같은 곳은 하나로 묶음) */
interface SavedSpot {
  result: PlaceResult
  where: string // "Day 1, Day 4" / "가고 싶은 곳"
  search: string // 검색어 비교용 (이름 + 현지어 이름, 소문자)
  from?: Plan // 들를 곳 모드: 이 일정을 들를 곳으로 옮겨 옴
}

/**
 * 들를 곳 모드에서 "일정에서 가져오기": 같은 날 장소 → 가고 싶은 곳 (지도 위치가 있는 장소만, 큰 장소 자신은 빼고)
 * 고르면 그 일정은 일정에서 빠지고 큰 장소의 들를 곳으로 들어감
 */
function takeCandidates(plans: Plan[], days: string[], parent: Plan): SavedSpot[] {
  const undated = (p: Plan) => !days.includes(p.date)
  return plans
    .filter((p) => p.type === 'place' && p.id !== parent.id && (p.date === parent.date || undated(p)))
    .filter(hasCoords)
    .sort((a, b) => Number(undated(a)) - Number(undated(b)) || a.order - b.order)
    .map((p) => ({
      result: { key: p.id, name: p.title, localName: p.place, lat: p.lat, lng: p.lng, kind: p.kind, area: p.area, placeId: p.placeId },
      where: undated(p) ? '가고 싶은 곳' : `Day ${days.indexOf(p.date) + 1}`,
      search: `${p.title} ${p.place}`.toLowerCase(),
      from: p,
    }))
}

const SAVED_PREVIEW = 5 // 처음엔 이만큼만, 나머지는 [더 보기]

/**
 * 이 여행에 넣은 장소: 다시 검색하지 않고 바로 고르기 (숙소처럼 여러 날 들르는 곳, 가고 싶은 곳에 모아 둔 곳)
 *   지도 위치가 있는 장소만, 같은 곳(구글 장소 ID 또는 이름 + 위치)은 하나로 묶고 어느 날에 있는지 같이 보여 줌
 *   순서: 숙소(매일 들르니까) → 가고 싶은 곳(날짜를 아직 안 정한 후보) → Day 1부터
 */
function savedSpots(plans: Plan[], days: string[]): SavedSpot[] {
  const dayIdx = (d: string) => days.indexOf(d) // 가고 싶은 곳(날짜 없음·여행 밖 날짜)은 -1
  const rank = (p: Plan) => (categoryFromKind(p.kind) === 'lodging' ? 0 : dayIdx(p.date) < 0 ? 1 : 2)
  const list = plans
    .filter((p) => p.type === 'place')
    .filter(hasCoords)
    .sort((a, b) => rank(a) - rank(b) || dayIdx(a.date) - dayIdx(b.date) || a.order - b.order)
  const groups = new Map<string, { plan: (typeof list)[number]; days: Set<number> }>()
  for (const p of list) {
    const key = p.placeId || `${p.title}|${p.lat.toFixed(4)},${p.lng.toFixed(4)}`
    const g = groups.get(key)
    if (g) g.days.add(dayIdx(p.date))
    else groups.set(key, { plan: p, days: new Set([dayIdx(p.date)]) })
  }
  return [...groups.values()].map(({ plan, days: idx }) => {
    // Day 순서대로, 가고 싶은 곳은 맨 뒤. 너무 많으면 "외 N"
    const labels = [...idx].sort((a, b) => (a < 0 ? 1e9 : a) - (b < 0 ? 1e9 : b)).map((i) => (i < 0 ? '가고 싶은 곳' : `Day ${i + 1}`))
    const where = labels.length > 3 ? `${labels.slice(0, 3).join(', ')} 외 ${labels.length - 3}` : labels.join(', ')
    return {
      result: { key: plan.id, name: plan.title, localName: plan.place, lat: plan.lat, lng: plan.lng, kind: plan.kind, area: plan.area, placeId: plan.placeId },
      where,
      search: `${plan.title} ${plan.place}`.toLowerCase(),
    }
  })
}

/**
 * 장소 추가·수정
 *   추가: 장소 검색(구글이면 입력하는 동안 자동완성) → 고르기, 못 찾으면 지도에서 직접 찍기
 *         이 여행에 이미 넣은 장소는 검색 없이 목록에서 바로 고르기 (같은 장소를 이 날에도 하나 더 넣음, 원래 것은 그대로)
 *   수정: 이름·시간·메모만. 장소와 날짜는 그대로 (바꾸려면 삭제하고 그 날에서 새로 추가)
 */
export function PlaceSheet({ trip, days, allPlans, initial: openedWith, defaultDate, spotOf = null, onAddSpot, onClose }: Props) {
  // 창을 열 때의 값으로 고정: 저장할 때 "내가 바꾼 칸"을 이 값과 비교해서 고른다
  // (그사이 일행이 고친 값과 비교하면, 내가 안 건드린 칸까지 옛 값으로 덮어쓰게 됨)
  const [initial] = useState(openedWith)
  const google = useGoogleEnabled()
  const near: LatLng[] = allPlans.filter(hasCoords).map((p) => ({ lat: p.lat, lng: p.lng }))
  // 날짜는 고르지 않음: 추가는 지금 보고 있는 날, 수정은 원래 날 그대로
  const date = initial?.date ?? defaultDate
  const [time, setTime] = useState(initial?.time ?? '')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [memo, setMemo] = useState(initial?.memo ?? '')
  const [placeText, setPlaceText] = useState(initial?.place ?? '')
  const [spot, setSpot] = useState<Spot | null>(() =>
    initial && hasCoords(initial)
      ? {
          lat: initial.lat,
          lng: initial.lng,
          name: initial.title,
          localName: initial.place,
          kind: initial.kind,
          area: initial.area,
          placeId: initial.placeId,
        }
      : null,
  )
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<GoogleSuggestion[] | null>(null)
  const [results, setResults] = useState<PlaceResult[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState('')
  const tokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // 검색에서 고를 때 자동으로 넣은 이름. 이름 칸이 아직 이 값이면 [변경] 후 다른 곳을 고를 때 새 이름으로 바꿈
  // (직접 고쳐 적은 이름은 그대로 둠)
  const autoName = useRef('')
  useEffect(() => () => abortRef.current?.abort(), [])

  // 이 여행에 이미 넣은 장소: 검색칸이 비어 있으면 목록으로, 입력하면 이름이 맞는 곳을 검색 결과 위에
  // (들를 곳 모드에선 "일정에서 가져오기": 같은 날 장소·가고 싶은 곳을 옮겨 옴)
  const saved = useMemo(() => (spotOf ? takeCandidates(allPlans, days, spotOf) : savedSpots(allPlans, days)), [allPlans, days, spotOf])
  const savedLabel = spotOf ? '일정에서 가져오기 · 일정에서는 빠져요' : '이 여행에 넣은 장소'
  const [showAllSaved, setShowAllSaved] = useState(false)
  const [pickedFrom, setPickedFrom] = useState<Plan | null>(null) // 들를 곳 모드: 일정에서 가져온 장소
  const q = query.trim().toLowerCase()
  const savedHits = q ? saved.filter((s) => s.search.includes(q)).slice(0, 3) : []

  // 구글: 입력이 멈추면(0.25초) 자동완성 후보를 가져온다
  useEffect(() => {
    if (!google) return
    const q = query.trim()
    if (!q) {
      setSuggestions(null)
      return
    }
    let alive = true
    const timer = setTimeout(() => {
      void (async () => {
        try {
          tokenRef.current ??= await newSearchSession()
          const list = await googleSuggest(q, tokenRef.current, near)
          if (alive) {
            setSuggestions(list)
            setSearchError('')
          }
        } catch {
          if (alive) setSearchError('구글 검색이 안 돼서 무료 검색으로 바꿨어요. 다시 검색해 주세요')
        }
      })()
    }, 250)
    return () => {
      alive = false
      clearTimeout(timer)
    }
    // near 는 렌더마다 새 배열이라 넣지 않는다
  }, [query, google])

  // 무료 검색: 검색 버튼을 눌렀을 때만
  const runFreeSearch = async () => {
    const q = query.trim()
    if (!q || busy) return
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setBusy(true)
    setSearchError('')
    setResults(null)
    try {
      setResults(await searchPlacesFree(q, near, ac.signal))
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setSearchError(e instanceof Error ? e.message : '검색하지 못했어요')
    } finally {
      if (abortRef.current === ac) setBusy(false)
    }
  }

  /** from: 들를 곳 모드에서 "일정에서 가져오기"로 고른 일정 (검색에서 고르면 null) */
  const choose = (r: PlaceResult, from: Plan | null = null) => {
    setSpot({ lat: r.lat, lng: r.lng, name: r.name, localName: r.localName, kind: r.kind, area: r.area, placeId: r.placeId ?? '' })
    setPlaceText(r.localName)
    setResults(null)
    setSuggestions(null)
    setQuery('')
    setPicking(false)
    if (!title.trim() || title === autoName.current) {
      setTitle(r.name)
      autoName.current = r.name
    }
    setPickedFrom(from)
    if (from?.memo && !memo.trim()) setMemo(from.memo) // 가져온 장소의 메모도 같이
    setError('')
  }

  const chooseGoogle = async (s: GoogleSuggestion) => {
    if (busy) return // 두 번 눌러도 장소 정보는 한 번만 가져옴
    setBusy(true)
    try {
      choose(await googleResolve(s))
      tokenRef.current = null // 고르면 검색 세션 끝
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : '장소 정보를 가져오지 못했어요')
    } finally {
      setBusy(false)
    }
  }

  /** 이 여행에 넣은 장소 한 줄: 누르면 검색에서 고른 것처럼 장소가 채워짐 (시간·메모는 새로) */
  const savedRow = (s: SavedSpot) => (
    <li key={s.result.key}>
      <button
        type="button"
        onClick={() => choose(s.result, s.from ?? null)}
        disabled={busy}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-neutral-50 disabled:opacity-50"
      >
        {/* 종류별 색 점 (일정 번호·지도 핀과 같은 색: 음식점 코랄 · 숙소 민트 · 나머지 보라) */}
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: placeColor(s.result.kind).bg }} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{s.result.name}</span>
          <span className="block truncate text-xs text-neutral-500">
            {[s.where, kindLabel(s.result.kind), areaLabel(s.result)].filter(Boolean).join(' · ')}
          </span>
        </span>
      </button>
    </li>
  )

  const pickOnMap = (pos: LatLng) => {
    // 현지어 이름은 검색어가 있을 때만 (없으면 구글맵을 좌표로 연다)
    setSpot((s) => ({
      ...pos,
      name: s?.name || title.trim() || query.trim() || '직접 찍은 위치',
      localName: s?.localName || query.trim(),
      kind: s?.kind ?? '',
      area: s?.area ?? '',
      placeId: '', // 위치를 옮기면 구글 장소와는 연결 끊김
    }))
    setError('')
  }

  const save = () => {
    const name = title.trim() || spot?.name || query.trim()
    if (!name) {
      setError('장소를 검색하거나 이름을 적어 주세요')
      return
    }
    if (spotOf) {
      // 들를 곳 모드: 큰 장소의 들를 곳 목록에 추가 (일정에서 가져온 거면 그 일정은 PlansTab에서 옮김 처리)
      onAddSpot?.(
        {
          id: newId(),
          title: name,
          place: spot ? spot.localName : query.trim() || placeText,
          placeId: spot?.placeId ?? '',
          lat: spot?.lat ?? null,
          lng: spot?.lng ?? null,
          kind: spot?.kind ?? '',
          memo: memo.trim(),
          done: pickedFrom?.done ?? false,
        },
        pickedFrom,
      )
      onClose()
      return
    }
    const now = Date.now()
    const sameDay = allPlans.filter((p) => p.id !== initial?.id && p.date === date)
    const moved = !initial || initial.date !== date || (time !== '' && initial.time !== time)
    const plan: Plan = {
      id: initial?.id ?? newId(),
      type: 'place',
      date,
      time,
      order: moved || !initial ? orderForInsert(sameDay, time) : initial.order,
      title: name,
      place: spot ? spot.localName : query.trim() || placeText,
      placeId: spot?.placeId ?? '',
      mapUrl: initial?.mapUrl ?? '',
      memo: memo.trim(),
      done: initial?.done ?? false,
      lat: spot?.lat ?? null,
      lng: spot?.lng ?? null,
      kind: spot?.kind ?? '',
      area: spot?.area ?? '',
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    }
    // 오프라인이면 서버 응답을 기다리지 않고 닫는다 (화면엔 바로 반영, 연결되면 동기화)
    if (initial) {
      // 수정: 바꾼 칸만 (그사이 일행이 고친 다른 칸은 그대로, 일행이 지운 장소는 되살리지 않음)
      const changes = changedFields(initial, { title: plan.title, time: plan.time, memo: plan.memo, order: plan.order })
      if (Object.keys(changes).length) repo.patchItem(trip.id, 'plans', initial.id, { ...changes, updatedAt: now }).catch(reportError)
    } else {
      repo.saveItem(trip.id, 'plans', plan).catch(reportError)
    }
    onClose()
  }

  const remove = async () => {
    if (!initial) return
    const ok = await askConfirm({ title: '이 장소를 일정에서 뺄까요?', message: '이 장소 사진도 같이 지워져요', confirmLabel: '삭제', danger: true })
    if (!ok) return
    repo.deleteItem(trip.id, 'plans', initial.id).catch(reportError)
    repo.deletePhotosOf(trip.id, initial.id).catch(() => {}) // 사진은 못 지워도 일정 삭제는 그대로
    onClose()
  }

  return (
    <Sheet
      title={initial ? '장소 수정' : spotOf ? '들를 곳 추가' : '장소 추가'}
      // 날짜 칸이 없으니 어느 날인지 제목 아래에 표시 (들를 곳 모드는 어느 장소 안인지)
      subtitle={<p className="truncate text-[13px] text-neutral-500">{spotOf ? `${spotOf.title} 안에서 둘러볼 곳` : dayText(days, date)}</p>}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {initial && (
            <button type="button" onClick={remove} className={btnDanger}>
              삭제
            </button>
          )}
          {/* 고른 장소의 위치를 가져오는 중엔 저장 막음 (안 그러면 지도 위치 없이 저장됨) */}
          <button type="button" onClick={save} disabled={busy} className={btnPrimary}>
            {busy ? '불러오는 중…' : '저장'}
          </button>
        </div>
      }
    >
      <div>
        <span className="mb-1.5 block text-[13px] font-medium text-neutral-500">장소</span>
        {initial ? (
          // 수정에선 장소를 못 바꿈 (바꾸려면 삭제하고 새로 추가)
          <div className="flex items-center gap-3 rounded-xl bg-neutral-100 px-3.5 py-3">
            <span aria-hidden="true">📍</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium">{spot?.name ?? initial.title}</p>
              <p className="truncate text-xs text-neutral-500">
                {spot ? [kindLabel(spot.kind), areaLabel(spot)].filter(Boolean).join(' · ') || '지도에서 찍은 위치' : '지도 위치 없음'}
              </p>
            </div>
          </div>
        ) : spot ? (
          <div className="flex items-center gap-3 rounded-xl bg-neutral-100 px-3.5 py-3">
            <span aria-hidden="true">📍</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium">{spot.name}</p>
              <p className="truncate text-xs text-neutral-500">{[kindLabel(spot.kind), areaLabel(spot)].filter(Boolean).join(' · ') || '지도에서 찍은 위치'}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSpot(null)
                setPlaceText('')
                setPickedFrom(null)
              }}
              className="shrink-0 text-sm font-medium text-neutral-500"
            >
              변경
            </button>
          </div>
        ) : (
          <>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (!google) void runFreeSearch()
              }}
            >
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={google ? '장소 이름으로 검색 (예: 나고야성, 히츠마부시)' : '장소 검색 (예: 名古屋城, Nagoya Castle)'}
                enterKeyHint="search"
                aria-label="장소 검색"
                className={inputCls}
                autoFocus={!initial}
              />
              {!google && (
                <button type="submit" disabled={busy} className="shrink-0 rounded-xl bg-[#2F87F2] px-4 text-sm font-semibold text-white disabled:opacity-40">
                  검색
                </button>
              )}
            </form>
            {!google && <p className="mt-1.5 text-xs text-neutral-400">한국어로 안 나오면 일본어나 영어로 검색해 보세요</p>}

            {/* 검색칸이 비어 있을 때: 이 여행에 넣은 장소 목록 (숙소 → 가고 싶은 곳 → Day 순) */}
            {!q && saved.length > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 text-[12px] font-medium text-neutral-400">{savedLabel}</p>
                <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200">
                  {(showAllSaved ? saved : saved.slice(0, SAVED_PREVIEW)).map(savedRow)}
                </ul>
                {!showAllSaved && saved.length > SAVED_PREVIEW && (
                  <button
                    type="button"
                    onClick={() => setShowAllSaved(true)}
                    className="mt-1 w-full py-2 text-[13px] font-medium text-neutral-500 active:text-neutral-700"
                  >
                    더 보기 ({saved.length - SAVED_PREVIEW}곳)
                  </button>
                )}
              </div>
            )}

            {busy && <p className="mt-3 text-sm text-neutral-500">찾는 중…</p>}
            {searchError && <p className="mt-3 text-sm text-red-600">{searchError}</p>}

            {/* 입력 중: 이 여행에 넣은 장소 중 이름이 맞는 곳을 검색 결과 위에 (검색 비용 없이 바로) */}
            {savedHits.length > 0 && (
              <>
                <p className="mb-1.5 mt-3 text-[12px] font-medium text-neutral-400">{savedLabel}</p>
                <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200">{savedHits.map(savedRow)}</ul>
              </>
            )}

            {google && suggestions && (
              <>
                {savedHits.length > 0 && <p className="-mb-0.5 mt-3 text-[12px] font-medium text-neutral-400">검색 결과</p>}
                {suggestions.length > 0 ? (
                  <ul className="mt-2 divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200">
                    {suggestions.map((s) => (
                      <li key={s.placeId}>
                        <button
                          type="button"
                          onClick={() => void chooseGoogle(s)}
                          disabled={busy}
                          className="w-full px-3.5 py-3 text-left active:bg-neutral-50 disabled:opacity-50"
                        >
                          <p className="text-[15px] font-medium">{s.main}</p>
                          {s.secondary && <p className="truncate text-xs text-neutral-500">{s.secondary}</p>}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-neutral-500">검색 결과가 없어요. 지도에서 직접 찍어 주세요.</p>
                )}
                <p className="mt-1.5 text-right text-[11px] text-neutral-400">Google Maps</p>
              </>
            )}

            {!google && results && savedHits.length > 0 && <p className="-mb-0.5 mt-3 text-[12px] font-medium text-neutral-400">검색 결과</p>}
            {!google &&
              results &&
              (results.length > 0 ? (
                <ul className="mt-2 divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200">
                  {results.map((r) => (
                    <li key={r.key}>
                      <button type="button" onClick={() => choose(r)} className="w-full px-3.5 py-3 text-left active:bg-neutral-50">
                        <p className="text-[15px] font-medium">{r.name}</p>
                        <p className="text-xs text-neutral-500">{[kindLabel(r.kind), areaLabel(r)].filter(Boolean).join(' · ')}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-neutral-500">검색 결과가 없어요. 다른 이름으로 찾거나 지도에서 직접 찍어 주세요.</p>
              ))}
          </>
        )}
        {!initial && (
          <button
            type="button"
            onClick={() => setPicking((v) => !v)}
            className="mt-2.5 text-[13px] font-medium text-neutral-500 underline underline-offset-2"
          >
            {picking ? '지도 닫기' : '지도에서 직접 위치 찍기'}
          </button>
        )}
        {picking && !initial && (
          <>
            <MapView
              className="mt-2 h-52 w-full overflow-hidden rounded-xl bg-neutral-100"
              pins={spot ? [{ id: 'spot', lat: spot.lat, lng: spot.lng, label: '', title: spot.name, color: '#2F87F2', ink: '#ffffff' }] : []}
              fallbackCenter={spot ?? centerOf(near)}
              onMapClick={pickOnMap}
              keepView
            />
            <p className="mt-1.5 text-xs text-neutral-400">지도를 누르면 그 자리에 핀이 꽂혀요</p>
          </>
        )}
      </div>

      <Field label="이름">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            setError('')
          }}
          placeholder="예: 나고야성 구경, 히츠마부시 점심"
          className={inputCls}
        />
      </Field>
      {error && <p className="-mt-3 text-sm text-red-600">{error}</p>}

      {/* 들를 곳엔 시간이 없음 (큰 장소의 시간을 따름) */}
      {!spotOf && <TimePicker value={time} onChange={setTime} suggest={suggestTime(allPlans, date, initial?.id)} />}

      <Field label="메모 (선택)">
        <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={3} placeholder="예약번호, 꼭 먹을 메뉴…" className={inputCls} />
      </Field>
    </Sheet>
  )
}
