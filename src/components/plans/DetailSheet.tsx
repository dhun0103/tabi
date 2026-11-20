import { useEffect, useState, type ReactNode } from 'react'
import { googleDirectionsUrl, googlePlaceUrl, hasCoords } from '../../lib/geo'
import { googlePlaceInfo, useGoogleEnabled, type PlaceInfo } from '../../lib/google'
import { categoryOf, fmtDay, fmtKRW, fmtMoney, mondayIndex, toKRW } from '../../lib/util'
import type { Expense, Plan } from '../../types'
import { KindIcon } from '../icons'
import { Sheet } from '../ui'

interface Props {
  plan: Plan
  number: number
  color: { bg: string; ink: string }
  dayLabel: string // 'Day 1 · 12/5(토)'
  expenses: Expense[] // 이 장소에 연결된 지출
  rate: number // 100엔 = ?원
  onAddExpense: () => void
  onOpenExpense: (e: Expense) => void
  onEdit: () => void
  onClose: () => void
}

/**
 * 장소 상세: 위에 사진(구글 장소일 때) → 이름·종류 → 버튼 4개(길찾기·구글맵·지출·수정)
 * → 영업시간·주소 → 메모 → 이 장소에서 쓴 돈
 */
export function DetailSheet({ plan, number, color, dayLabel, expenses, rate, onAddExpense, onOpenExpense, onEdit, onClose }: Props) {
  const google = useGoogleEnabled()
  const [info, setInfo] = useState<PlaceInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [allHours, setAllHours] = useState(false)

  useEffect(() => {
    if (!google || !plan.placeId) return
    let alive = true
    setLoading(true)
    googlePlaceInfo(plan.placeId)
      .then((i) => alive && setInfo(i))
      .catch(() => {})
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [plan.placeId, google])

  const placeUrl = googlePlaceUrl(plan)
  const dirUrl = googleDirectionsUrl(plan)
  // 영업시간은 "그 일정 날짜"의 요일 기준 (날짜 미정이면 오늘)
  const dayIdx = mondayIndex(plan.date)
  const hoursLine = info?.hours[dayIdx]
  const total = expenses.reduce((a, e) => a + toKRW(e.amount, e.currency, rate), 0)
  const meta = [plan.kind, plan.area].filter(Boolean).join(' · ')

  return (
    <Sheet title={plan.title} onClose={onClose}>
      {loading && !info && <div className="h-44 animate-pulse rounded-2xl bg-neutral-100" />}
      {info?.photoUrl && (
        <figure>
          <img src={info.photoUrl} alt={plan.title} className="h-48 w-full rounded-2xl object-cover" />
          {info.photoBy && (
            <figcaption className="mt-1 text-right text-[11px] text-neutral-400">
              사진{' '}
              {info.photoBy.uri ? (
                <a href={info.photoBy.uri} target="_blank" rel="noopener noreferrer" className="underline">
                  {info.photoBy.name}
                </a>
              ) : (
                info.photoBy.name
              )}
            </figcaption>
          )}
        </figure>
      )}

      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-500">
          <KindIcon kind={plan.kind} className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[13px] text-neutral-500">
            {number > 0 && (
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold"
                style={hasCoords(plan) ? { background: color.bg, color: color.ink } : { background: '#e5e5e5', color: '#737373' }}
              >
                {number}
              </span>
            )}
            {[dayLabel || fmtDay(plan.date), plan.time].filter(Boolean).join(' · ')}
          </p>
          {(meta || info?.rating != null) && (
            <p className="mt-1 text-sm text-neutral-600">
              {info?.rating != null && (
                <span className="mr-2 font-semibold text-neutral-900">
                  ★ {info.rating.toFixed(1)}
                  {info.ratingCount != null && <span className="ml-1 font-normal text-neutral-400">({info.ratingCount.toLocaleString('ko-KR')})</span>}
                </span>
              )}
              {meta}
            </p>
          )}
        </div>
      </div>

      {/* 자주 쓰는 동작 4개 */}
      <div className="grid grid-cols-4 gap-2">
        <Action href={dirUrl} label="길찾기" primary>
          <path d="M3 11l18-8-8 18-2-8-8-2z" />
        </Action>
        <Action href={placeUrl} label="구글맵">
          <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
          <circle cx="12" cy="10" r="2.3" />
        </Action>
        <Action onClick={onAddExpense} label="지출 추가">
          <rect x="3" y="6" width="18" height="13" rx="2.5" />
          <path d="M3 10h18M15 15h3" />
        </Action>
        <Action onClick={onEdit} label="수정">
          <path d="M4 20h4L19 9l-4-4L4 16v4z" />
        </Action>
      </div>

      {info && (hoursLine || info.address || info.phone || info.website) && (
        <ul className="space-y-2.5 rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-700">
          {hoursLine && (
            <Row icon="🕘">
              <button type="button" onClick={() => setAllHours((v) => !v)} className="text-left">
                {hoursLine} <span className="text-xs text-neutral-400">{allHours ? '접기' : '요일별'}</span>
              </button>
              {allHours && (
                <ul className="mt-1.5 space-y-0.5 text-[13px] text-neutral-500">
                  {info.hours.map((h, i) => (
                    <li key={h} className={i === dayIdx ? 'font-semibold text-neutral-800' : ''}>
                      {h}
                    </li>
                  ))}
                </ul>
              )}
            </Row>
          )}
          {info.address && <Row icon="📍">{info.address}</Row>}
          {info.phone && (
            <Row icon="📞">
              <a href={`tel:${info.phone.replace(/\s/g, '')}`} className="underline underline-offset-2">
                {info.phone}
              </a>
            </Row>
          )}
          {info.website && (
            <Row icon="🔗">
              <a href={info.website} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-2">
                {info.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
              </a>
            </Row>
          )}
        </ul>
      )}

      {plan.memo && (
        <div className="rounded-2xl bg-neutral-50 p-4 text-sm leading-relaxed">
          <p className="mb-1 text-[13px] font-semibold text-neutral-900">메모</p>
          <p className="whitespace-pre-wrap text-neutral-700">{plan.memo}</p>
        </div>
      )}

      <section>
        <div className="flex items-baseline justify-between">
          <h3 className="text-[15px] font-bold">이 장소에서 쓴 돈</h3>
          {expenses.length > 0 && <span className="text-[15px] font-bold tabular-nums">{fmtKRW(total)}</span>}
        </div>
        {expenses.length > 0 ? (
          <ul className="mt-2 divide-y divide-neutral-100 rounded-2xl border border-neutral-200 px-4">
            {expenses.map((e) => {
              const c = categoryOf(e.category)
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => onOpenExpense(e)} className="flex w-full items-center gap-2.5 py-3 text-left text-sm">
                    <span aria-hidden="true">{c.emoji}</span>
                    <span className="min-w-0 flex-1 truncate text-neutral-700">{e.title || c.label}</span>
                    <span className="font-semibold tabular-nums">{fmtMoney(e.amount, e.currency)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <button
            type="button"
            onClick={onAddExpense}
            className="mt-2 w-full rounded-2xl border border-dashed border-neutral-300 py-3.5 text-sm font-medium text-neutral-500 active:bg-neutral-50"
          >
            여기서 쓴 돈을 기록해 보세요
          </button>
        )}
      </section>

      {google && !plan.placeId && (
        <p className="text-xs leading-relaxed text-neutral-400">수정 → 장소 변경에서 구글로 다시 검색해 넣으면 사진·평점·영업시간이 나와요.</p>
      )}
      {info && <p className="text-right text-[11px] text-neutral-400">Google Maps</p>}
    </Sheet>
  )
}

/** 아이콘 + 글자 버튼 (링크 또는 버튼) */
function Action(props: { label: string; href?: string | null; onClick?: () => void; primary?: boolean; children: ReactNode }) {
  const cls = `flex flex-col items-center gap-1 rounded-2xl py-3 text-[12px] font-semibold ${
    props.primary ? 'bg-neutral-900 text-white active:bg-neutral-700' : 'bg-neutral-100 text-neutral-700 active:bg-neutral-200'
  }`
  const icon = (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {props.children}
    </svg>
  )
  if (props.href !== undefined) {
    return props.href ? (
      <a href={props.href} target="_blank" rel="noopener noreferrer" className={cls}>
        {icon}
        {props.label}
      </a>
    ) : (
      <span className={`${cls} opacity-30`} aria-disabled="true">
        {icon}
        {props.label}
      </span>
    )
  }
  return (
    <button type="button" onClick={props.onClick} className={cls}>
      {icon}
      {props.label}
    </button>
  )
}

function Row({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="w-5 shrink-0 text-center" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  )
}
