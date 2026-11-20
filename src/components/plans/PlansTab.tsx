import { useEffect, useMemo, useRef, useState } from 'react'
import { NEUTRAL_COLOR, centerOf, dayColor, googleRouteUrl, hasCoords, type LatLng } from '../../lib/geo'
import { byOrder, moveItem, optimizeRoute, reindex, sortByTime } from '../../lib/order'
import { fmtDay, todayStr, tripDays } from '../../lib/util'
import { repo } from '../../store'
import type { Plan, Trip } from '../../types'
import { MapView, type MapPin, type MapRoute } from '../map/MapView'
import { Empty, btnGhost, reportError } from '../ui'
import { DetailSheet } from './DetailSheet'
import { MemoSheet } from './MemoSheet'
import { PlaceSheet } from './PlaceSheet'
import { Timeline } from './Timeline'

const ALL = 'all' // 전체 일정 보기
const UNDATED = '' // 날짜 미정 = 가고 싶은 곳 모음

type SheetState =
  | { kind: 'detail'; plan: Plan }
  | { kind: 'place'; plan: Plan | null }
  | { kind: 'memo'; plan: Plan | null }
  | null

const dashed = 'rounded-xl border border-dashed border-neutral-300 py-3.5 text-sm font-medium text-neutral-600 active:bg-neutral-50'

export function PlansTab({ trip, plans }: { trip: Trip; plans: Plan[] }) {
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
  const near: LatLng[] = plans.filter(hasCoords).map((p) => ({ lat: p.lat, lng: p.lng }))

  useEffect(() => {
    setActiveId(null)
    setEditing(false)
  }, [view])

  // 날짜 탭: 고른 탭이 보이게 가로 스크롤
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
  const dayLabelOf = (p: Plan) => (isUndated(p) ? '날짜 미정' : `DAY ${days.indexOf(p.date) + 1} · ${fmtDay(p.date)}`)

  const tabs = [
    { key: ALL, top: '전체', bottom: `${days.length}일`, dot: '' },
    ...days.map((d, i) => ({ key: d, top: `DAY ${i + 1}`, bottom: fmtDay(d), dot: dayColor(i).bg })),
    { key: UNDATED, top: '미정', bottom: '가고 싶은 곳', dot: NEUTRAL_COLOR.bg },
  ]
  const addDate = view === ALL ? (days[0] ?? UNDATED) : view
  const undatedCount = itemsOf(UNDATED).length
  // 시트에는 항상 최신 데이터 (일행이 고쳤을 수도 있으니)
  const sheetPlan = sheet?.plan ? (plans.find((p) => p.id === sheet.plan!.id) ?? sheet.plan) : null

  return (
    <>
      <div className="sticky z-20 border-b border-neutral-100 bg-white" style={{ top: 'calc(56px + env(safe-area-inset-top))' }}>
        <div className="flex overflow-x-auto px-2 [scrollbar-width:none]">
          {tabs.map((t) => {
            const active = t.key === view
            const n = t.key === ALL ? 0 : itemsOf(t.key).filter((p) => p.type === 'place').length
            return (
              <button
                key={t.key || 'undated'}
                ref={(el) => {
                  if (el) tabRefs.current.set(t.key, el)
                  else tabRefs.current.delete(t.key)
                }}
                type="button"
                aria-pressed={active}
                aria-label={`${t.top} ${t.bottom}${n ? `, 장소 ${n}곳` : ''}`}
                onClick={() => setPicked(t.key)}
                className={`relative shrink-0 px-3 pb-2.5 pt-3 text-center ${active ? 'text-neutral-900' : 'text-neutral-400'}`}
              >
                <span className="flex items-center justify-center gap-1.5 text-[13px] font-bold tracking-tight">
                  {t.dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.dot }} aria-hidden="true" />}
                  {t.top}
                </span>
                <span className="mt-0.5 block text-[11px]">{t.bottom}</span>
                {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-neutral-900" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      </div>

      <MapView
        className="h-56 w-full bg-neutral-100"
        pins={pins}
        routes={routes}
        activeId={activeId}
        fallbackCenter={centerOf(near)}
        onPinClick={focusOnList}
      />

      <div className="px-4">
        {view === ALL ? (
          <>
            {days.map((d, i) => {
              const items = itemsOf(d)
              return (
                <section key={d} className="pt-5">
                  <button type="button" onClick={() => setPicked(d)} className="flex w-full items-center justify-between pb-1.5 text-left">
                    <h3 className="flex items-center gap-2 text-[15px] font-bold">
                      <span className="h-2 w-2 rounded-full" style={{ background: dayColor(i).bg }} aria-hidden="true" />
                      DAY {i + 1}
                      <span className="text-[13px] font-normal text-neutral-400">{fmtDay(d)}</span>
                    </h3>
                    <span className="text-[13px] text-neutral-400">{items.filter((p) => p.type === 'place').length}곳 ›</span>
                  </button>
                  {items.length ? (
                    <Timeline items={items} color={dayColor(i)} activeId={activeId} editing={false} onOpen={openItem} onFocus={(p) => setActiveId(p.id)} onMove={() => {}} />
                  ) : (
                    <p className="pb-2 pt-1 text-sm text-neutral-400">아직 일정이 없어요</p>
                  )}
                </section>
              )
            })}
            {undatedCount > 0 && (
              <button type="button" onClick={() => setPicked(UNDATED)} className="mt-4 flex w-full justify-between rounded-xl bg-neutral-50 px-4 py-3.5 text-sm">
                <span className="font-medium">가고 싶은 곳</span>
                <span className="text-neutral-400">{undatedCount}개 ›</span>
              </button>
            )}
            <button type="button" onClick={() => setSheet({ kind: 'place', plan: null })} className={`${dashed} my-4 w-full`}>
              + 장소 추가
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 pb-2 pt-5">
              <h2 className="text-[17px] font-bold">
                {view === UNDATED ? '가고 싶은 곳' : `DAY ${days.indexOf(view) + 1}`}
                <span className="ml-2 text-sm font-normal text-neutral-400">{view === UNDATED ? '날짜 미정' : fmtDay(view)}</span>
              </h2>
              <div className="flex shrink-0 gap-1.5">
                {!editing && view !== UNDATED && googleRouteUrl(dayList) && (
                  <a href={googleRouteUrl(dayList)!} target="_blank" rel="noopener noreferrer" className={btnGhost}>
                    구글맵 동선 ↗
                  </a>
                )}
                {dayList.length > 1 && (
                  <button type="button" onClick={() => setEditing((v) => !v)} className={editing ? `${btnGhost} border-neutral-900 text-neutral-900` : btnGhost}>
                    {editing ? '완료' : '편집'}
                  </button>
                )}
              </div>
            </div>

            {editing && (
              <div className="mb-2 flex gap-1.5 rounded-xl bg-neutral-100 p-1.5">
                {view !== UNDATED && (
                  <button type="button" onClick={optimize} className="flex-1 rounded-lg bg-white py-2.5 text-[13px] font-semibold shadow-sm active:bg-neutral-50">
                    거리순 동선 정리
                  </button>
                )}
                <button type="button" onClick={timeSort} className="flex-1 rounded-lg bg-white py-2.5 text-[13px] font-semibold shadow-sm active:bg-neutral-50">
                  시간순 정리
                </button>
              </div>
            )}

            {dayList.length === 0 ? (
              <Empty icon="🗺️" title={view === UNDATED ? '모아 둔 장소가 없어요' : '아직 일정이 없어요'} desc="아래 버튼으로 장소를 추가해 보세요" />
            ) : (
              <Timeline
                items={dayList}
                color={colorOf(view)}
                activeId={activeId}
                editing={editing}
                onOpen={openItem}
                onFocus={(p) => setActiveId(p.id)}
                onMove={move}
              />
            )}

            {!editing && (
              <div className="mb-4 mt-1 flex gap-2">
                <button type="button" onClick={() => setSheet({ kind: 'place', plan: null })} className={`${dashed} flex-[2]`}>
                  + 장소 추가
                </button>
                <button type="button" onClick={() => setSheet({ kind: 'memo', plan: null })} className={`${dashed} flex-1`}>
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
          onEdit={() => setSheet({ kind: 'place', plan: sheetPlan })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'place' && (
        <PlaceSheet trip={trip} days={days} allPlans={plans} initial={sheetPlan} defaultDate={addDate} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === 'memo' && (
        <MemoSheet trip={trip} days={days} allPlans={plans} initial={sheetPlan} defaultDate={addDate} onClose={() => setSheet(null)} />
      )}
    </>
  )
}
