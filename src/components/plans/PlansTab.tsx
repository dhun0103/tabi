import { useEffect, useMemo, useRef, useState } from 'react'
import { onAppShown } from '../../hooks/useToday'
import { ROUTE_COLOR, centerOf, googleRouteUrl, hasCoords, placeColor, type LatLng } from '../../lib/geo'
import { byOrder, optimizeRoute, orderAfterMove, orderForInsert, reindex, sortByTime } from '../../lib/order'
import { categoryFromKind, expenseKRW, fmtDay, fmtJPY, fmtKRW, suggestTime, todayStr, tripDays } from '../../lib/util'
import { repo } from '../../store'
import type { Expense, Plan, SubSpot, Trip } from '../../types'
import { askConfirm, showAlert } from '../ConfirmDialog'
import { ExpenseSheet } from '../expenses/ExpenseSheet'
import { MapView, type MapPin, type MapRoute } from '../map/MapView'
import type { MapFocus } from '../map/mapTypes'
import { BLUE, Empty, btnGhost, cardCls, reportError } from '../ui'
import { DetailSheet } from './DetailSheet'
import { FlightSheet } from './FlightSheet'
import { MemoSheet } from './MemoSheet'
import { PlaceSheet } from './PlaceSheet'
import { Timeline } from './Timeline'

const UNDATED = '' // 날짜 미정 = 가고 싶은 곳 모음

type SheetState =
  | { kind: 'detail'; plan: Plan }
  | { kind: 'spot'; plan: Plan } // 이 장소에 들를 곳 추가
  | { kind: 'place'; plan: Plan | null }
  | { kind: 'memo'; plan: Plan | null }
  | { kind: 'flight'; plan: Plan | null }
  | { kind: 'expense'; plan: Plan; expense: Expense | null; mine?: boolean } // mine: 내 지출(이 폰에만)을 고치는 중
  | null

// 맨 아래 [메모 추가] [항공편 추가] [장소 추가]: 같은 너비, 흰 바탕 + 연한 테두리 (NOL처럼)
const addBtn = 'rounded-lg border border-neutral-200 bg-white py-3 text-[15px] font-semibold text-neutral-700 active:bg-neutral-50'

/** mine: 내 지출 (이 폰에만). 일정 카드의 쓴 돈에는 안 넣고, 장소 카드에서만 따로 보여 줌 */
export function PlansTab({ trip, plans, expenses, mine }: { trip: Trip; plans: Plan[]; expenses: Expense[]; mine: Expense[] }) {
  const days = useMemo(() => tripDays(trip.startDate, trip.endDate), [trip.startDate, trip.endDate])
  // 여행 중이면 오늘, 아니면 Day 1부터 (전체 보기는 없음: 트리플처럼 하루씩)
  const [picked, setPicked] = useState(() => (days.includes(todayStr()) ? todayStr() : (days[0] ?? UNDATED)))
  const view = picked === UNDATED || days.includes(picked) ? picked : (days[0] ?? UNDATED)
  const [editing, setEditing] = useState(false)
  const [sheet, setSheet] = useState<SheetState>(null)
  const [activeId, setActiveId] = useState<string | null>(null) // 장소 id, 들를 곳이면 "장소id:들를곳id"
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set()) // 들를 곳을 펼친 장소
  const [focus, setFocus] = useState<MapFocus | null>(null) // 들를 곳을 펼치거나 누를 때 지도를 그 동네로
  const [toast, setToast] = useState('')

  const isUndated = (p: Plan) => !p.date || !days.includes(p.date)
  const itemsOf = (key: string) => plans.filter((p) => (key === UNDATED ? isUndated(p) : p.date === key)).sort(byOrder)
  const placeCount = (items: Plan[]) => items.filter((p) => p.type === 'place').length
  const near: LatLng[] = plans.filter(hasCoords).map((p) => ({ lat: p.lat, lng: p.lng }))

  // 장소별로 쓴 돈 (일정 카드에 같이 표시)
  const expensesOf = (planId: string) => expenses.filter((e) => e.planId === planId)
  const spent = new Map<string, string>()
  for (const e of expenses) {
    if (!e.planId || spent.has(e.planId)) continue
    const list = expensesOf(e.planId)
    spent.set(
      e.planId,
      list.every((x) => x.currency === 'JPY')
        ? fmtJPY(list.reduce((a, x) => a + x.amount, 0))
        : fmtKRW(list.reduce((a, x) => a + expenseKRW(x, trip.krwPer100Jpy), 0)),
    )
  }

  useEffect(() => {
    setActiveId(null)
    setEditing(false)
    window.scrollTo({ top: 0 }) // 날을 바꾸면 그날 목록 처음부터 (지도는 하루 전체 보기)
  }, [view])

  // 날짜가 바뀐 뒤 앱으로 돌아오면(밤새 뒤에 재워 둔 앱을 아침에 다시 열면) 오늘 Day로
  // (보고 있는 중에 자정이 지날 땐 그대로 둠: 보던 목록이 갑자기 바뀌지 않게)
  const syncedOn = useRef(todayStr()) // 마지막으로 오늘 Day에 맞춘 날짜
  useEffect(
    () =>
      onAppShown(() => {
        const today = todayStr()
        if (today === syncedOn.current) return
        syncedOn.current = today
        if (days.includes(today)) setPicked(today)
      }),
    [days],
  )

  const dayList = itemsOf(view)

  /*
   * 스크롤 따라 지도 이동 (NOL처럼)
   *   지도 + Day 버튼은 헤더 밑에 붙어 있고, 그 바로 아래 줄(기준선)에 걸린 장소를 고름
   *   → 목록에서 그 장소가 강조되고 지도가 그 장소로 이동
   *   목록 맨 위로 돌아오면 고른 걸 풀어서 지도는 하루 전체 보기
   */
  const stickyRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const lockUntil = useRef(0) // 핀을 눌러 목록을 옮기는 동안엔 스크롤로 다른 장소를 고르지 않음
  const dragging = useRef(false) // 편집에서 순서를 끄는 동안에도 (지도가 이리저리 움직이지 않게)
  const placeKey = dayList
    .filter((p) => p.type === 'place')
    .map((p) => p.id)
    .join(',')
  useEffect(() => {
    const ids = placeKey ? placeKey.split(',') : []
    let frame = 0
    const pick = () => {
      frame = 0
      if (dragging.current || Date.now() < lockUntil.current) return
      if (window.scrollY < 8) {
        setActiveId(null)
        return
      }
      // 카드가 반 넘게 기준선 위로(지도·Day 버튼 밑으로) 들어가면 다음 장소로
      const line = stickyRef.current?.getBoundingClientRect().bottom ?? 0
      const top = ids.find((id) => {
        const r = document.getElementById(`plan-${id}`)?.getBoundingClientRect()
        return !!r && r.top + r.height / 2 > line
      })
      setActiveId(top ?? ids[ids.length - 1] ?? null)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(pick)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [placeKey])

  // 마지막 장소까지 기준선으로 올라올 수 있게 목록 끝에 빈 공간 (목록이 충분히 길면 0)
  const [tail, setTail] = useState(0)
  useEffect(() => {
    const list = listRef.current
    const sticky = stickyRef.current
    const main = list?.closest('main')
    if (!list || !sticky || !main) return
    const ids = placeKey ? placeKey.split(',') : []
    const measure = () => {
      const last = ids.length ? document.getElementById(`plan-${ids[ids.length - 1]}`) : null
      if (!last) {
        setTail(0)
        return
      }
      const line = sticky.getBoundingClientRect().bottom
      const padBottom = parseFloat(getComputedStyle(main).paddingBottom) || 0 // 탭바 자리
      const below = list.getBoundingClientRect().bottom - last.getBoundingClientRect().top + padBottom
      // 화면 높이: 사파리 주소창이 접히고 펴질 때마다 바뀌는 innerHeight 대신 레이아웃 높이 (스크롤 중 빈 공간이 출렁이지 않게)
      const screenH = document.documentElement.clientHeight
      setTail(Math.max(0, Math.ceil(screenH - line - below)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(list)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [placeKey])
  // 편집 중에 항목이 1개 이하로 줄면(지우거나 일행이 지움) 편집을 끝냄
  // (안 그러면 [완료] 버튼이 사라지고 추가 버튼도 안 보이는 채로 갇힘)
  useEffect(() => {
    if (dayList.length < 2) setEditing(false)
  }, [dayList.length])

  // Day 버튼: 고른 버튼이 보이게 가로 스크롤
  const tabRefs = useRef(new Map<string, HTMLButtonElement>())
  useEffect(() => {
    tabRefs.current.get(view)?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [view])

  // 지도: 고른 날의 장소만 (종류별 색 번호 핀 + 회색 점선 동선, NOL처럼)
  const pins: MapPin[] = []
  const routes: MapRoute[] = []
  {
    const places = dayList.filter((p) => p.type === 'place')
    places.forEach((p, i) => {
      const c = placeColor(p.kind)
      if (hasCoords(p)) pins.push({ id: p.id, lat: p.lat, lng: p.lng, label: String(i + 1), title: p.title, color: c.bg, ink: c.ink })
      // 들를 곳을 펼친 장소: 그 가게들을 "7-1" 흰 알약으로 (목록의 ①②와 같은 순서, 다녀온 곳은 회색, 동선 점선엔 안 넣음)
      if (!editing && expanded.has(p.id)) {
        ;(p.spots ?? []).forEach((s, j) => {
          if (s.lat === null || s.lng === null) return
          const sc = placeColor(s.kind)
          pins.push({
            id: `${p.id}:${s.id}`,
            lat: s.lat,
            lng: s.lng,
            label: `${i + 1}-${j + 1}`,
            title: `${i + 1}-${j + 1} ${s.title}`,
            color: sc.bg,
            ink: sc.ink,
            small: true,
            done: s.done,
          })
        })
      }
    })
    if (view !== UNDATED) routes.push({ color: ROUTE_COLOR, points: places.filter(hasCoords).map((p) => ({ lat: p.lat, lng: p.lng })) })
  }

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2200)
  }
  // 이미 있는 일정은 바꾼 칸만 저장: 그사이 일행이 고친 다른 칸(메모 등)을 덮어쓰지 않고, 일행이 지운 건 되살리지 않음
  const patch = (id: string, changes: Partial<Plan>) =>
    repo.patchItem(trip.id, 'plans', id, { ...changes, updatedAt: Date.now() }).catch(reportError)
  const saveOrder = (list: Plan[]) => reindex(list).forEach((p) => patch(p.id, { order: p.order }))
  // 장소 카드에서 시간·메모만 바로 고칠 때 (시간을 바꾸면 그 시간 자리로 순서도 옮김: 장소 수정 창과 같은 규칙)
  const updatePlan = (p: Plan, changes: Pick<Partial<Plan>, 'time' | 'memo'>) => {
    const t = changes.time
    const order =
      t !== undefined && t !== '' && t !== p.time
        ? orderForInsert(
            plans.filter((x) => x.id !== p.id && x.date === p.date),
            t,
          )
        : undefined
    patch(p.id, order === undefined ? changes : { ...changes, order })
  }
  const sameOrder = (a: Plan[], b: Plan[]) => a.every((p, i) => p.id === b[i]?.id)

  // 편집: ≡ 손잡이로 끌어서 순서 바꾸기 → 옮긴 항목 하나만 저장 (앞뒤 항목 사이 order)
  const reorder = (nextIds: string[], movedId: string) => {
    const byId = new Map(dayList.map((p) => [p.id, p]))
    orderAfterMove(nextIds.flatMap((id) => byId.get(id) ?? []), movedId).forEach((p) => patch(p.id, { order: p.order }))
  }
  // 끌 때 저절로 스크롤하는 경계: 위 = 지도·Day 버튼 아래, 아래 = 탭바 위
  const listEdges = () => ({
    top: stickyRef.current?.getBoundingClientRect().bottom ?? 0,
    bottom: document.querySelector('nav')?.getBoundingClientRect().top ?? window.innerHeight,
  })
  const optimize = () => {
    if (dayList.filter((p) => p.type === 'place' && hasCoords(p)).length < 3) {
      return flash('지도 위치가 있는 장소가 3곳 이상일 때 정리할 수 있어요')
    }
    const next = optimizeRoute(dayList)
    if (sameOrder(next, dayList)) return flash('이미 가장 짧은 동선이에요')
    saveOrder(next)
    flash('가까운 순서로 동선을 정리했어요 (시간은 그대로예요)')
  }
  const timeSort = () => {
    const next = sortByTime(dayList)
    if (sameOrder(next, dayList)) return flash('이미 시간 순서예요')
    saveOrder(next)
    flash('시간 순서로 정리했어요')
  }

  // 지도 핀을 누르면: 그 장소를 고르고, 목록에서 그 장소를 지도 바로 아래(기준선)로 올림
  // (들를 곳 점 "장소id:들를곳id"를 누르면 그 점을 고르고, 목록은 그 장소로)
  const focusOnList = (pinId: string) => {
    setActiveId(pinId)
    const el = document.getElementById(`plan-${pinId.split(':')[0]}`)
    if (!el) return
    const line = stickyRef.current?.getBoundingClientRect().bottom ?? 0
    lockUntil.current = Date.now() + 1000 // 목록이 움직이는 동안 지나가는 장소로 바뀌지 않게
    window.scrollTo({ top: Math.max(0, window.scrollY + el.getBoundingClientRect().top - line - 8), behavior: 'smooth' })
  }

  /* ───── 들를 곳 (장소 안에서 둘러볼 가게들: 그 장소 칸에 목록으로 저장) ───── */
  const latestOf = (p: Plan) => plans.find((x) => x.id === p.id) ?? p // 일행이 그사이 고쳤을 수도 있으니 최신 것으로
  const setSpots = (p: Plan, spots: SubSpot[]) => patch(p.id, { spots })
  const spotPoints = (p: Plan): LatLng[] => [
    ...(hasCoords(p) ? [{ lat: p.lat, lng: p.lng }] : []),
    ...(p.spots ?? []).flatMap((s) => (s.lat !== null && s.lng !== null ? [{ lat: s.lat, lng: s.lng }] : [])),
  ]
  // "들를 곳 N" 알약: 펼치면 카드 아래 목록 + 지도에 작은 점(그 동네가 보이게 확대), 접으면 그 장소로 조금 물러남
  const toggleExpand = (p: Plan) => {
    const open = !expanded.has(p.id)
    setExpanded((cur) => {
      const next = new Set(cur)
      if (open) next.add(p.id)
      else next.delete(p.id)
      return next
    })
    setActiveId(p.id)
    lockUntil.current = Date.now() + 600 // 목록 높이가 바뀌는 동안 스크롤 따라 다른 장소로 안 넘어가게
    const points = open ? spotPoints(p) : spotPoints({ ...p, spots: [] })
    if (points.length) setFocus({ key: Date.now(), points, zoom: open ? 17 : 14 })
  }
  const toggleSpot = (p: Plan, spotId: string) => {
    const cur = latestOf(p)
    setSpots(cur, (cur.spots ?? []).map((s) => (s.id === spotId ? { ...s, done: !s.done } : s)))
  }
  const focusSpot = (p: Plan, s: SubSpot) => {
    if (s.lat === null || s.lng === null) return
    setActiveId(`${p.id}:${s.id}`)
    setFocus({ key: Date.now(), points: [{ lat: s.lat, lng: s.lng }], zoom: 17 })
  }
  // 편집에서 들를 곳 순서 바꾸기 (그사이 일행이 더한 들를 곳은 맨 뒤에 그대로)
  const reorderSpots = (p: Plan, nextIds: string[]) => {
    const cur = latestOf(p)
    const all = cur.spots ?? []
    const byId = new Map(all.map((s) => [s.id, s]))
    setSpots(cur, [...nextIds.flatMap((id) => byId.get(id) ?? []), ...all.filter((s) => !nextIds.includes(s.id))])
  }
  // 편집에서 들를 곳 이름만 고치기 (구글맵 검색어·위치는 그대로)
  const renameSpot = (p: Plan, spotId: string, title: string) => {
    const cur = latestOf(p)
    setSpots(cur, (cur.spots ?? []).map((s) => (s.id === spotId ? { ...s, title } : s)))
  }
  const removeSpot = async (p: Plan, spotId: string) => {
    const s = latestOf(p).spots?.find((x) => x.id === spotId)
    if (!s || !(await askConfirm({ title: `"${s.title}"을 들를 곳에서 뺄까요?`, confirmLabel: '빼기', danger: true }))) return
    const cur = latestOf(p)
    setSpots(cur, (cur.spots ?? []).filter((x) => x.id !== spotId))
  }
  /**
   * 들를 곳 추가. from: 일정에 있던 장소를 가져온 거면 그 장소
   *   → 그 장소의 지출·사진은 이 장소에 붙이고(사진을 옮긴 뒤에) 일정에서는 뺌
   */
  const addSpot = (p: Plan, spot: SubSpot, from: Plan | null) => {
    const cur = latestOf(p)
    setSpots(cur, [...(cur.spots ?? []), spot])
    setExpanded((s) => new Set(s).add(p.id))
    if (!from) return
    const now = Date.now()
    for (const e of expenses.filter((x) => x.planId === from.id)) repo.patchItem(trip.id, 'expenses', e.id, { planId: p.id, updatedAt: now }).catch(reportError)
    for (const e of mine.filter((x) => x.planId === from.id)) repo.patchMine(trip.id, e.id, { planId: p.id, updatedAt: now }).catch(reportError)
    repo
      .movePhotos(trip.id, from.id, p.id)
      .then(() => repo.deleteItem(trip.id, 'plans', from.id))
      .catch(reportError)
  }
  const openItem = (p: Plan) =>
    setSheet(p.type === 'memo' ? { kind: 'memo', plan: p } : p.type === 'flight' ? { kind: 'flight', plan: p } : { kind: 'detail', plan: p })

  const tabs = [...days.map((d, i) => ({ key: d, label: `Day ${i + 1}` })), { key: UNDATED, label: '미정' }]
  // 시트에는 항상 최신 데이터 (일행이 고쳤을 수도 있으니)
  const sheetPlan = sheet?.plan ? (plans.find((p) => p.id === sheet.plan!.id) ?? sheet.plan) : null
  // 열어 둔 창의 항목을 일행이 지웠으면 창을 닫고 알려 줌 (그대로 두면 고칠 때 지운 게 되살아남)
  const gone =
    sheet?.kind === 'expense' && sheet.expense && !(sheet.mine ? mine : expenses).some((e) => e.id === sheet.expense!.id)
      ? '지출'
      : sheet?.plan && !plans.some((p) => p.id === sheet.plan!.id)
        ? '항목'
        : ''
  useEffect(() => {
    if (!gone) return
    setSheet(null)
    void showAlert(`일행이 이 ${gone}을 지웠어요`)
  }, [gone])
  const routeUrl = view !== UNDATED ? googleRouteUrl(dayList) : null

  return (
    <>
      {/* 지도 + Day 알약 버튼: 스크롤해도 헤더 밑에 붙어 있음 (NOL처럼). 지도 높이는 폰 화면 높이에 맞춰 160~210px */}
      <div ref={stickyRef} className="sticky z-20" style={{ top: 'calc(57px + env(safe-area-inset-top))' }}>
        <div style={{ height: 'clamp(160px, 25vh, 210px)' }}>
          <MapView
            className="h-full w-full bg-neutral-200"
            pins={pins}
            routes={routes}
            activeId={activeId}
            fallbackCenter={centerOf(near)}
            focus={focus}
            onPinClick={focusOnList}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto bg-[#f4f5f8]/95 px-4 py-3 backdrop-blur [scrollbar-width:none]">
          {tabs.map((t) => {
            const active = t.key === view
            const n = placeCount(itemsOf(t.key))
            const dateText = t.key ? ` ${fmtDay(t.key)}` : ''
            return (
              <button
                key={t.key || 'undated'}
                ref={(el) => {
                  if (el) tabRefs.current.set(t.key, el)
                  else tabRefs.current.delete(t.key)
                }}
                type="button"
                aria-pressed={active}
                aria-label={`${t.label}${dateText}${n ? `, 장소 ${n}곳` : ''}`}
                onClick={() => setPicked(t.key)}
                className={`shrink-0 rounded-full px-4 py-2 text-[14px] font-bold transition-colors ${
                  active ? 'shadow-sm' : 'bg-white text-neutral-500 ring-1 ring-neutral-200 active:bg-neutral-50'
                }`}
                style={active ? { background: BLUE, color: '#ffffff' } : undefined}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      <div ref={listRef} className="px-4">
        <div className="flex items-center justify-between gap-3 pb-2 pt-1">
          <h2 className="min-w-0 truncate">
            <span className="text-[16px] font-bold">{view === UNDATED ? '가고 싶은 곳' : `Day ${days.indexOf(view) + 1}`}</span>
            <span className="ml-1.5 text-[14px] text-neutral-400">
              {view === UNDATED ? '날짜 미정' : fmtDay(view)}
            </span>
          </h2>
          <div className="flex shrink-0 items-center gap-1">
            {!editing && routeUrl && (
              <a href={routeUrl} target="_blank" rel="noopener noreferrer" className={btnGhost}>
                동선 ↗
              </a>
            )}
            {dayList.length > 1 && (
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className={`rounded-full px-2.5 py-1.5 text-[14px] font-medium ${editing ? 'font-bold text-neutral-900' : 'text-neutral-500'}`}
              >
                {editing ? '완료' : '편집'}
              </button>
            )}
          </div>
        </div>

        {editing && (
          <div className="mb-3 flex gap-2">
            {view !== UNDATED && (
              <button type="button" onClick={optimize} className={`${cardCls} flex-1 py-3 text-[13px] font-bold active:bg-neutral-50`}>
                거리순 동선 정리
              </button>
            )}
            <button type="button" onClick={timeSort} className={`${cardCls} flex-1 py-3 text-[13px] font-bold active:bg-neutral-50`}>
              시간순 정리
            </button>
          </div>
        )}

        {dayList.length === 0 ? (
          <Empty
            icon="🗺️"
            title={view === UNDATED ? '모아 둔 장소가 없어요' : '아직 일정이 없어요'}
            desc="아래 버튼으로 갈 곳을 추가해 보세요"
          />
        ) : (
          <Timeline
            items={dayList}
            spent={spent}
            activeId={activeId}
            editing={editing}
            onOpen={openItem}
            onFocus={(p) => setActiveId(p.id)}
            expanded={expanded}
            onToggleExpand={toggleExpand}
            onToggleSpot={toggleSpot}
            onFocusSpot={focusSpot}
            onReorderSpots={reorderSpots}
            onRenameSpot={renameSpot}
            onReorder={reorder}
            edges={listEdges}
            onDragChange={(d) => {
              dragging.current = d
            }}
          />
        )}

        {/* 지금 보고 있는 날(또는 미정)에 추가된다 → 장소·메모 창에서 날짜를 따로 고르지 않음 */}
        {!editing && (
          <div className="mb-4 mt-2 grid grid-cols-3 gap-2">
            <button type="button" onClick={() => setSheet({ kind: 'memo', plan: null })} className={addBtn}>
              메모 추가
            </button>
            <button type="button" onClick={() => setSheet({ kind: 'flight', plan: null })} className={addBtn}>
              항공편 추가
            </button>
            <button type="button" onClick={() => setSheet({ kind: 'place', plan: null })} className={addBtn}>
              장소 추가
            </button>
          </div>
        )}
      </div>
      {tail > 0 && <div aria-hidden="true" style={{ height: tail }} />}

      {toast && (
        <div
          role="status"
          className="fixed left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-full bg-neutral-900 px-4 py-2.5 text-sm text-white shadow-lg"
          style={{ bottom: 'calc(84px + env(safe-area-inset-bottom))' }}
        >
          {toast}
        </div>
      )}

      {sheet?.kind === 'detail' && sheetPlan && (
        <DetailSheet
          tripId={trip.id}
          plan={sheetPlan}
          expenses={expensesOf(sheetPlan.id)}
          mine={mine.filter((e) => e.planId === sheetPlan.id)}
          rate={trip.krwPer100Jpy}
          suggestTime={suggestTime(plans, sheetPlan.date, sheetPlan.id)}
          onUpdate={(changes) => updatePlan(sheetPlan, changes)}
          onAddExpense={() => setSheet({ kind: 'expense', plan: sheetPlan, expense: null })}
          onOpenExpense={(e, isMine) => setSheet({ kind: 'expense', plan: sheetPlan, expense: e, mine: isMine })}
          onEdit={() => setSheet({ kind: 'place', plan: sheetPlan })}
          onAddSpot={() => setSheet({ kind: 'spot', plan: sheetPlan })}
          onToggleSpot={(spotId) => toggleSpot(sheetPlan, spotId)}
          onRemoveSpot={(spotId) => void removeSpot(sheetPlan, spotId)}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'place' && (
        <PlaceSheet trip={trip} days={days} allPlans={plans} initial={sheetPlan} defaultDate={view} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === 'spot' && sheetPlan && (
        // 들를 곳 추가: 장소 추가 창을 "들를 곳" 모드로 (검색 · 이 날 일정에서 가져오기 · 지도에서 찍기)
        <PlaceSheet
          trip={trip}
          days={days}
          allPlans={plans}
          initial={null}
          defaultDate={sheetPlan.date}
          spotOf={sheetPlan}
          onAddSpot={(s, from) => addSpot(sheetPlan, s, from)}
          onClose={() => setSheet({ kind: 'detail', plan: sheetPlan })}
        />
      )}
      {sheet?.kind === 'expense' && sheetPlan && (
        <ExpenseSheet
          trip={trip}
          plans={plans}
          initial={sheet.expense}
          prefill={{
            date: sheetPlan.date || todayStr(),
            category: categoryFromKind(sheetPlan.kind),
            planId: sheetPlan.id,
          }}
          mine={sheet.mine}
          onClose={() => setSheet({ kind: 'detail', plan: sheetPlan })}
        />
      )}
      {sheet?.kind === 'memo' && (
        <MemoSheet trip={trip} days={days} allPlans={plans} initial={sheetPlan} defaultDate={view} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === 'flight' && (
        <FlightSheet trip={trip} days={days} allPlans={plans} initial={sheetPlan} defaultDate={view} onClose={() => setSheet(null)} />
      )}
    </>
  )
}
