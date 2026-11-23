import { useEffect, useState, type ReactNode } from 'react'
import { googleDirectionsUrl, googlePlaceUrl, hasCoords } from '../../lib/geo'
import { googlePlaceInfo, useGoogleEnabled, type PlaceInfo } from '../../lib/google'
import { categoryOf, expenseKRW, fmtDay, fmtKRW, fmtMoney, mondayIndex } from '../../lib/util'
import type { Expense, Plan } from '../../types'
import { CategoryIcon } from '../icons'
import { BLUE, MINT, Sheet, btnOutline, btnPrimary } from '../ui'

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
 * 장소 상세 (트리플 장소 화면 순서, 그림 없이 가볍게)
 *   이름 · 번호·날짜·시간 · 평점·종류·동네
 *   → 회색 정보 상자(주소·전화·홈페이지) → [구글맵][길찾기]
 *   → 이용가능시간 ⌄ → 메모 → 이 장소에서 쓴 돈 → 일정 수정
 * 지도·사진은 넣지 않는다: 위치는 일정 화면 위 지도와 [구글맵] 버튼으로 보고,
 * 구글 키를 넣은 뒤에도 상세를 열 때마다 지도·사진 요청이 나가지 않게
 */
export function DetailSheet({ plan, number, color, dayLabel, expenses, rate, onAddExpense, onOpenExpense, onEdit, onClose }: Props) {
  const google = useGoogleEnabled()
  const [loaded, setLoaded] = useState<{ placeId: string; info: PlaceInfo } | null>(null)
  const [allHours, setAllHours] = useState(false)

  useEffect(() => {
    if (!google || !plan.placeId) return
    const placeId = plan.placeId
    let alive = true
    googlePlaceInfo(placeId)
      .then((info) => {
        if (alive) setLoaded({ placeId, info })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [plan.placeId, google])

  // 열어 둔 사이 일행이 장소를 바꾸면(실시간 동기화) 이전 장소의 평점·영업시간은 버린다
  const info = google && loaded?.placeId === plan.placeId ? loaded.info : null

  const pinned = hasCoords(plan)
  const placeUrl = googlePlaceUrl(plan)
  const dirUrl = googleDirectionsUrl(plan)
  // 영업시간은 "그 일정 날짜"의 요일 기준 (날짜 미정이면 오늘)
  const dayIdx = mondayIndex(plan.date)
  const hoursLine = info?.hours[dayIdx]
  const hoursText = hoursLine?.split(/:\s(.+)/)[1] ?? hoursLine
  const total = expenses.reduce((a, e) => a + expenseKRW(e, rate), 0) // 지출마다 적을 때의 환율
  const meta = [plan.kind, plan.area].filter(Boolean).join(' · ')
  const when = [dayLabel || fmtDay(plan.date), plan.time].filter(Boolean).join(' · ')

  const subtitle = (
    <>
      <p className="flex items-center gap-1.5 text-[13px] leading-5 text-neutral-500">
        {number > 0 && (
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
            style={pinned ? { background: color.bg, color: color.ink } : { background: '#e5e5e5', color: '#737373' }}
          >
            {number}
          </span>
        )}
        {when}
      </p>
      {(meta || info?.rating != null) && (
        <p className="mt-1 text-sm text-neutral-500">
          {info?.rating != null && (
            <span className="mr-1.5 font-semibold text-neutral-800">
              <span className="text-[#FFB800]">★</span> {info.rating.toFixed(1)}
              {info.ratingCount != null && <span className="ml-0.5 font-normal text-neutral-400">({info.ratingCount.toLocaleString('ko-KR')})</span>}
              {meta && <span className="mx-1 text-neutral-300">·</span>}
            </span>
          )}
          {meta}
        </p>
      )}
    </>
  )

  return (
    <Sheet title={plan.title} subtitle={subtitle} onClose={onClose}>
      {/* 구글 장소일 때만: 동네는 제목 아래에 이미 있으니 상자는 정확한 주소·전화·홈페이지만 */}
      {info && (info.address || info.phone || info.website) && (
        <dl className="space-y-2.5 rounded-xl bg-[#F5F5F5] px-4 py-3.5 text-[14px]">
          {info.address && <InfoRow label="주소">{info.address}</InfoRow>}
          {info.phone && (
            <InfoRow label="전화">
              <a href={`tel:${info.phone.replace(/\s/g, '')}`}>{info.phone}</a>
            </InfoRow>
          )}
          {info.website && (
            <InfoRow label="홈페이지">
              <a href={info.website} target="_blank" rel="noopener noreferrer" className="break-all">
                {info.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
              </a>
            </InfoRow>
          )}
        </dl>
      )}

      <div className="grid grid-cols-[1fr_1.4fr] gap-2">
        {placeUrl ? (
          <a href={placeUrl} target="_blank" rel="noopener noreferrer" className={`${btnOutline} text-center`}>
            구글맵
          </a>
        ) : (
          <span className={`${btnOutline} text-center opacity-30`}>구글맵</span>
        )}
        {dirUrl ? (
          <a href={dirUrl} target="_blank" rel="noopener noreferrer" className={`${btnPrimary} text-center`}>
            길찾기
          </a>
        ) : (
          <span className={`${btnPrimary} text-center opacity-30`}>길찾기</span>
        )}
      </div>

      {info && info.hours.length > 0 && (
        <section className="border-t border-neutral-100 pt-4">
          <button type="button" onClick={() => setAllHours((v) => !v)} className="flex w-full items-center justify-between text-left">
            <span className="text-[15px] font-semibold text-neutral-800">이용가능시간, 휴무일</span>
            <svg
              viewBox="0 0 24 24"
              className={`h-5 w-5 text-neutral-500 transition-transform ${allHours ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {hoursText && (
            <p className="mt-1.5 text-[15px] font-semibold" style={{ color: BLUE }}>
              {plan.date ? fmtDay(plan.date) : '오늘'} <span className="ml-1">{hoursText}</span>
            </p>
          )}
          {allHours && (
            <ul className="mt-2 space-y-1 text-[13px] text-neutral-500">
              {info.hours.map((h, i) => (
                <li key={h} className={i === dayIdx ? 'font-semibold text-neutral-800' : ''}>
                  {h}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {plan.memo && (
        <section className="border-t border-neutral-100 pt-4">
          <p className="text-[15px] font-semibold text-neutral-800">메모</p>
          <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-neutral-600">{plan.memo}</p>
        </section>
      )}

      <section className="border-t border-neutral-100 pt-4">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[15px] font-semibold text-neutral-800">이 장소에서 쓴 돈</h3>
          {expenses.length > 0 && <span className="text-[15px] font-bold tabular-nums">{fmtKRW(total)}</span>}
        </div>
        {expenses.length > 0 && (
          <ul className="mt-1 divide-y divide-neutral-100">
            {expenses.map((e) => {
              const c = categoryOf(e.category)
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => onOpenExpense(e)} className="flex w-full items-center gap-2.5 py-3 text-left text-[14px]">
                    <span style={{ color: MINT }}>
                      <CategoryIcon category={e.category} className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-neutral-700">{e.title || c.label}</span>
                    <span className="font-semibold tabular-nums">{fmtMoney(e.amount, e.currency)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <button
          type="button"
          onClick={onAddExpense}
          className="mt-2 w-full rounded-xl border border-neutral-300 py-3 text-[14px] font-semibold text-neutral-700 active:bg-neutral-50"
        >
          + 지출 추가
        </button>
      </section>

      {/* 날짜·시간·장소·메모 바꾸기 / 삭제는 수정 화면에서 */}
      <section className="border-t border-neutral-100 pt-4">
        <button
          type="button"
          onClick={onEdit}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#F3F3F3] py-3 text-[14px] font-semibold text-neutral-700 active:bg-neutral-200"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 20h4L19 9l-4-4L4 16v4z" />
            <path d="M14 6l4 4" />
          </svg>
          일정 수정
        </button>
        {google && !plan.placeId && (
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            일정 수정 → 장소 변경에서 구글로 다시 검색해 넣으면 평점·영업시간·전화가 나와요.
          </p>
        )}
      </section>

      {info && <p className="text-right text-[11px] text-neutral-400">Google Maps</p>}
    </Sheet>
  )
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-14 shrink-0 font-semibold text-neutral-800">{label}</dt>
      <dd className="min-w-0 flex-1 text-neutral-600">{children}</dd>
    </div>
  )
}
