import { useMemo, useState } from 'react'
import {
  METHODS,
  addDays,
  categoryOf,
  expenseKRW,
  fmtDay,
  fmtJPY,
  fmtKRW,
  fmtMoney,
  todayStr,
  tripDays,
} from '../lib/util'
import type { Expense, Plan, Trip } from '../types'
import { CategoryPage, PeriodSelect, type Period } from './expenses/CategoryPage'
import { ExpenseSheet } from './expenses/ExpenseSheet'
import { CategoryIcon } from './icons'
import { MINT, cardCls } from './ui'

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

type SheetState = { kind: 'edit'; expense: Expense | null; date?: string } | { kind: 'stats' } | null

/**
 * 여행 비용 (트리플 "여행비용" 구조)
 *   맨 위: 총액 + 기간 필터 · 오른쪽 위 원그래프 버튼 → 카테고리별 지출 페이지
 *   목록: 여행 준비 → Day 1 → … → 여행 후, 섹션마다 "비용 추가"
 */
export function ExpensesTab({ trip, expenses, plans }: { trip: Trip; expenses: Expense[]; plans: Plan[] }) {
  const days = useMemo(() => tripDays(trip.startDate, trip.endDate), [trip.startDate, trip.endDate])
  const [filter, setFilter] = useState('all')
  const [sheet, setSheet] = useState<SheetState>(null)
  const rate = trip.krwPer100Jpy // 기본 환율: 환율이 저장 안 된 예전 지출에만 쓰임
  const krw = (e: Expense) => expenseKRW(e, rate) // 지출마다 적을 때의 환율
  const group = trip.members.length >= 2

  const bucketOf = (e: Expense) => (!e.date || e.date < trip.startDate ? 'pre' : e.date > trip.endDate ? 'post' : e.date)
  const today = todayStr()
  const sections = [
    { key: 'pre', title: '여행 준비', sub: '항공권 · 숙소 · 환전 등', date: today < trip.startDate ? today : addDays(trip.startDate, -1) },
    ...days.map((d, i) => ({ key: d, title: `Day ${i + 1}`, sub: fmtDay(d), date: d })),
    { key: 'post', title: '여행 후', sub: '', date: addDays(trip.endDate || trip.startDate, 1) },
  ]
  const itemsOf = (key: string) =>
    expenses.filter((e) => bucketOf(e) === key).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
  const visible = sections.filter((s) => (filter === 'all' ? s.key !== 'post' || itemsOf('post').length > 0 : s.key === filter))
  const periods: Period[] = [
    { value: 'all', label: '기간 전체' },
    ...sections.map((s) => ({ value: s.key, label: s.key === 'pre' || s.key === 'post' ? s.title : `${s.title} · ${s.sub}` })),
  ]

  const scoped = filter === 'all' ? expenses : itemsOf(filter)
  const total = sum(scoped.map(krw))
  const jpy = sum(scoped.filter((e) => e.currency === 'JPY').map((e) => e.amount))
  const perPerson = group ? total / trip.members.length : 0 // 고른 기간의 합계를 일행 수로 나눔
  const placeOf = (e: Expense) => (e.planId ? plans.find((p) => p.id === e.planId)?.title : '')

  return (
    <>
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-extrabold tracking-tight">여행 비용</h2>
          <button
            type="button"
            onClick={() => setSheet({ kind: 'stats' })}
            aria-label="카테고리별 지출"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-neutral-700 shadow-sm ring-1 ring-neutral-200 active:bg-neutral-50"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v9h9" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          </button>
        </div>

        <div className="mt-3">
          <PeriodSelect periods={periods} value={filter} onChange={setFilter} />
        </div>

        <div className={`${cardCls} mt-3 p-5`}>
          <p className="text-[13px] text-neutral-500">{filter === 'all' ? '총 지출' : `${sections.find((s) => s.key === filter)?.title} 지출`}</p>
          <p className="mt-1 text-[34px] font-extrabold leading-tight tracking-tight">{fmtKRW(total)}</p>
          <p className="mt-1 text-[13px] text-neutral-500">
            엔화 {fmtJPY(jpy)}
            {perPerson > 0 && (
              <>
                {' '}
                <span className="text-neutral-300">·</span> 1인당 {fmtKRW(perPerson)}
              </>
            )}
          </p>
        </div>
      </div>

      {visible.map((s) => {
        const items = itemsOf(s.key)
        return (
          <section key={s.key} className={`${cardCls} mx-4 mt-3 px-5 pb-4 pt-4`}>
            <div className="flex items-baseline justify-between">
              <h3>
                <span className="text-[16px] font-bold">{s.title}</span>
                {s.sub && <span className="ml-1.5 text-[13px] text-neutral-400">{s.sub}</span>}
              </h3>
              {items.length > 0 && <span className="text-[14px] font-semibold tabular-nums text-neutral-500">{fmtKRW(sum(items.map(krw)))}</span>}
            </div>
            {items.length > 0 && (
              <ul className="mt-1 divide-y divide-neutral-100">
                {items.map((e) => {
                  const c = categoryOf(e.category)
                  const place = placeOf(e)
                  const left = [
                    place ? `📍 ${place}` : c.label,
                    METHODS.find((m) => m.id === e.method)?.label,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                  return (
                    <li key={e.id}>
                      <button type="button" onClick={() => setSheet({ kind: 'edit', expense: e })} className="flex w-full items-center gap-3 py-3.5 text-left">
                        <span className="flex h-9 w-7 shrink-0 items-center justify-center" style={{ color: MINT }}>
                          <CategoryIcon category={e.category} className="h-[20px] w-[20px]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold">{e.title || place || c.label}</span>
                          <span className="block truncate text-[12px] text-neutral-400">{left}</span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-[15px] font-bold tabular-nums">{fmtMoney(e.amount, e.currency)}</span>
                          {e.currency === 'JPY' && <span className="block text-[12px] tabular-nums text-neutral-400">{fmtKRW(krw(e))}</span>}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setSheet({ kind: 'edit', expense: null, date: s.date })}
              className="mt-2 w-full rounded-xl border border-neutral-200 py-2.5 text-[14px] font-semibold text-neutral-700 active:bg-neutral-50"
            >
              비용 추가
            </button>
          </section>
        )
      })}
      <div className="h-4" />

      {sheet?.kind === 'edit' && (
        <ExpenseSheet
          trip={trip}
          plans={plans}
          initial={sheet.expense}
          prefill={sheet.date ? { date: sheet.date } : undefined}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'stats' && (
        <CategoryPage trip={trip} expenses={scoped} periods={periods} period={filter} onPeriod={setFilter} onClose={() => setSheet(null)} />
      )}
    </>
  )
}
