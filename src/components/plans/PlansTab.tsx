import { useEffect, useMemo, useRef, useState } from 'react'
import { NEUTRAL_COLOR, centerOf, dayColor, googleRouteUrl, hasCoords, type LatLng } from '../../lib/geo'
import { byOrder, moveItem, optimizeRoute, reindex, sortByTime } from '../../lib/order'
import { categoryFromKind, fmtDay, fmtJPY, fmtKRW, todayStr, toKRW, tripDays } from '../../lib/util'
import { repo } from '../../store'
import type { Expense, Plan, Trip } from '../../types'
import { ExpenseSheet } from '../expenses/ExpenseSheet'
import { MapView, type MapPin, type MapRoute } from '../map/MapView'
import { Empty, btnGhost, cardCls, reportError } from '../ui'
import { DetailSheet } from './DetailSheet'
import { MemoSheet } from './MemoSheet'
import { PlaceSheet } from './PlaceSheet'
import { Timeline } from './Timeline'

const ALL = 'all' // 전체 일정 보기
const UNDATED = '' // 날짜 미정 = 가고 싶은 곳 모음

type SheetState =
  | { kind: 'detail'; plan: Plan }
  | { kind: 'place'; plan: Plan | null; date?: string }
  | { kind: 'memo'; plan: Plan | null }
  | { kind: 'expense'; plan: Plan; expense: Expense | null }
  | null

const addBtn =
  'flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-neutral-300 bg-white/70 py-3.5 text-[14px] font-semibold text-neutral-600 active:bg-white'

export function PlansTab({ trip, plans, expenses }: { trip: Trip; plans: Plan[]; expenses: Expense[] }) {
  const days = useMemo(() => tripDays(trip.startDate, trip.endDate), [trip.startDate, trip.endDate])
  // 여행 중이면 오늘, 아니면 전체 일정부터
  const [picked, setPicked] = useState(() => (days.includes(todayStr()) ? todayStr() : ALL))
  const view = picked === ALL || picked === UNDATED || days.includes(picked) ? picked : ALL
  const [editing, setEditing] = useState(false)
  const [sheet, setSheet] = useState<SheetState>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const isUndated = (p: Plan) => !p.date || !days.includes(p.date)
  const itemsOf = (key: string) => plans.filter((p) => (key === UNDATED ? isUndated(p) : p.date === key)).sort(byOrder)
  const colorOf = (key: string) => (key === UNDATED ? NEUTRAL_COLOR : dayColor(days.indexOf(key)))
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
        : fmtKRW(list.reduce((a, x) => a + toKRW(x.amount, x.currency, trip.krwPer100Jpy), 0)),
    )
  }

  useEffect(() => {
    setActiveId(null)
    setEditing(false)
  }, [view])

  // Day 버튼: 고른 버튼이 보이게 가로 스크롤
  const tabRefs = useRef(new Map<string, HTMLButtonElement>())
  useEffect(() => {
    tabRefs.current.get(view)?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [view])

  // 지도: 전체면 날짜마다 색이 다른 핀·동선, 하루면 그날만
  const groups = view === ALL ? days.map((d) => ({ key: d, items: itemsOf(d) })) : [{ key: view, items: itemsOf(view) }]
  const pins: MapPin[] = []
  const routes: MapRoute[] = []
  for (const g of groups) {
    const c = colorOf(g.key)
    const places = g.items.filter((p) => p.type === 'place')
    places.forEach((p, i) => {
      if (hasCoords(p)) pins.push({ id: p.id, lat: p.lat, lng: p.lng, label: String(i + 1), title: p.title, color: c.bg, ink: c.ink })
    })
    if (g.key !== UNDATED) routes.push({ color: c.bg, points: places.filter(hasCoords).map((p) => ({ lat: p.lat, lng: p.lng })) })
  }

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2200)
  }
  const save = (p: Plan) => repo.saveItem(trip.id, 'plans', p).catch(reportError)
  const dayList = view === ALL ? [] : itemsOf(view)
  const sameOrder = (a: Plan[], b: Plan[]) => a.every((p, i) => p.id === b[i]?.id)

  const move = (index: number, delta: -1 | 1) => reindex(moveItem(dayList, index, delta)).forEach(save)
  const optimize = () => {
    if (dayList.filter((p) => p.type === 'place' && hasCoords(p)).length < 3) {
      return flash('지도 위치가 있는 장소가 3곳 이상일 때 정리할 수 있어요')
    }
    const next = optimizeRoute(dayList)
    if (sameOrder(next, dayList)) return flash('이미 가장 짧은 동선이에요')
    reindex(next).forEach(save)
    flash('가까운 순서로 동선을 정리했어요 (시간은 그대로예요)')
  }
  const timeSort = () => {
    const next = sortByTime(dayList)
    if (sameOrder(next, dayList)) return flash('이미 시간 순서예요')
    reindex(next).forEach(save)
    flash('시간 순서로 정리했어요')
  }

  const focusOnList = (id: string) => {
    setActiveId(id)
    document.getElementById(`plan-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  const openItem = (p: Plan) => setSheet(p.type === 'memo' ? { kind: 'memo', plan: p } : { kind: 'detail', plan: p })
  const numberOf = (p: Plan) => itemsOf(isUndated(p) ? UNDATED : p.date).filter((x) => x.type === 'place').findIndex((x) => x.id === p.id) + 1
  const dayLabelOf = (p: Plan) => (isUndated(p) ? '날짜 미정' : `Day ${days.indexOf(p.date) + 1} · ${fmtDay(p.date)}`)

  const tabs = [
    { key: ALL, label: '전체', bg: '#171717', ink: '#ffffff' },
    ...days.map((d, i) => ({ key: d, label: `Day ${i + 1}`, bg: dayColor(i).bg, ink: dayColor(i).ink })),
    { key: UNDATED, label: '미정', bg: NEUTRAL_COLOR.bg, ink: NEUTRAL_COLOR.ink },
  ]
  const addDate = view === ALL ? (days[0] ?? UNDATED) : view
  const undatedCount = itemsOf(UNDATED).length
  // 시트에는 항상 최신 데이터 (일행이 고쳤을 수도 있으니)
  const sheetPlan = sheet?.plan ? (plans.find((p) => p.id === sheet.plan!.id) ?? sheet.plan) : null
  const routeUrl = view !== ALL && view !== UNDATED ? googleRouteUrl(dayList) : null

  return (
    <>
      <MapView
        className="h-60 w-full bg-neutral-200"
        pins={pins}
        routes={routes}
        activeId={activeId}
        fallbackCenter={centerOf(near)}
        onPinClick={focusOnList}
      />

      {/* Day 알약 버튼: 지도 아래에 있다가, 스크롤하면 헤더 밑에 붙는다 */}
      <div className="sticky z-20 bg-[#f4f5f8]/95 backdrop-blur" style={{ top: 'calc(57px + env(safe-area-inset-top))' }}>
        <div className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
          {tabs.map((t) => {
            const active = t.key === view
            const n = t.key === ALL ? 0 : placeCount(itemsOf(t.key))
            const dateText = t.key && t.key !== ALL ? ` ${fmtDay(t.key)}` : ''
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
                style={active ? { background: t.bg, color: t.ink } : undefined}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="px-4">
        {view === ALL ? (
          <>
            {days.map((d, i) => {
              const items = itemsOf(d)
              return (
                <section key={d} className="pb-2 pt-3">
                  <button type="button" onClick={() => setPicked(d)} className="flex w-full items-baseline justify-between pb-2 text-left">
                    <span>
                      <span className="text-[16px] font-bold">Day {i + 1}</span>
                      <span className="ml-1.5 text-[14px] text-neutral-400">{fmtDay(d)}</span>
                    </span>
                    <span className="text-[13px] text-neutral-400">{placeCount(items)}곳 ›</span>
                  </button>
                  {items.length ? (
                    <Timeline
                      items={items}
                      color={dayColor(i)}
                      spent={spent}
                      activeId={activeId}
                      editing={false}
                      onOpen={openItem}
                      onFocus={(p) => setActiveId(p.id)}
                      onMove={() => {}}
                    />
                  ) : (
                    <button type="button" onClick={() => setSheet({ kind: 'place', plan: null, date: d })} className={`${addBtn} mb-2 w-full`}>
                      + 이 날 갈 곳 추가
                    </button>
                  )}
                </section>
              )
            })}
            {undatedCount > 0 && (
              <button
                type="button"
                onClick={() => setPicked(UNDATED)}
                className={`${cardCls} mt-2 flex w-full items-center justify-between px-4 py-4 text-left`}
              >
                <span className="text-[15px] font-bold">가고 싶은 곳</span>
                <span className="text-[13px] text-neutral-400">{undatedCount}곳 ›</span>
              </button>
            )}
            <div className="h-4" />
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 pb-2 pt-1">
              <h2 className="min-w-0 truncate">
                <span className="text-[16px] font-bold">{view === UNDATED ? '가고 싶은 곳' : `Day ${days.indexOf(view) + 1}`}</span>
                <span className="ml-1.5 text-[14px] text-neutral-400">
                  {view === UNDATED ? '날짜 미정' : fmtDay(view)} · {placeCount(dayList)}곳
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
                color={colorOf(view)}
                spent={spent}
                activeId={activeId}
                editing={editing}
                onOpen={openItem}
                onFocus={(p) => setActiveId(p.id)}
                onMove={move}
              />
            )}

            {!editing && (
              <div className="mb-4 mt-1 flex gap-2">
                <button type="button" onClick={() => setSheet({ kind: 'place', plan: null })} className={`${addBtn} flex-[2]`}>
                  + 장소 추가
                </button>
                <button type="button" onClick={() => setSheet({ kind: 'memo', plan: null })} className={`${addBtn} flex-1`}>
                  + 메모
                </button>
              </div>
            )}
          </>
        )}
      </div>

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
          plan={sheetPlan}
          number={numberOf(sheetPlan)}
          color={colorOf(isUndated(sheetPlan) ? UNDATED : sheetPlan.date)}
          dayLabel={dayLabelOf(sheetPlan)}
          expenses={expensesOf(sheetPlan.id)}
          rate={trip.krwPer100Jpy}
          onAddExpense={() => setSheet({ kind: 'expense', plan: sheetPlan, expense: null })}
          onOpenExpense={(e) => setSheet({ kind: 'expense', plan: sheetPlan, expense: e })}
          onEdit={() => setSheet({ kind: 'place', plan: sheetPlan })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'place' && (
        <PlaceSheet trip={trip} days={days} allPlans={plans} initial={sheetPlan} defaultDate={sheet.date ?? addDate} onClose={() => setSheet(null)} />
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
          onClose={() => setSheet({ kind: 'detail', plan: sheetPlan })}
        />
      )}
      {sheet?.kind === 'memo' && (
        <MemoSheet trip={trip} days={days} allPlans={plans} initial={sheetPlan} defaultDate={addDate} onClose={() => setSheet(null)} />
      )}
    </>
  )
}
