import { useMemo, useState } from 'react'
import {
  CATEGORIES,
  METHODS,
  addDays,
  categoryOf,
  fmtDay,
  fmtJPY,
  fmtKRW,
  fmtMoney,
  settle,
  todayStr,
  toKRW,
  tripDays,
} from '../lib/util'
import type { Expense, Plan, Trip } from '../types'
import { ExpenseSheet } from './expenses/ExpenseSheet'
import { CategoryIcon } from './icons'
import { BLUE, MINT, Sheet, cardCls } from './ui'

const ACCENT = BLUE // 금액 강조·막대 (트리플 파랑)
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

type SheetState = { kind: 'edit'; expense: Expense | null; date?: string } | { kind: 'settle' } | { kind: 'stats' } | null

/**
 * 여행 비용 (트리플 "여행비용" 구조)
 *   맨 위: 총액 + 기간 필터 · 카테고리 통계 · 1/N 정산
 *   목록: 여행 준비 → Day 1 → … → 여행 후, 섹션마다 "비용 추가"
 */
export function ExpensesTab({ trip, expenses, plans }: { trip: Trip; expenses: Expense[]; plans: Plan[] }) {
  const days = useMemo(() => tripDays(trip.startDate, trip.endDate), [trip.startDate, trip.endDate])
  const [filter, setFilter] = useState('all')
  const [sheet, setSheet] = useState<SheetState>(null)
  const rate = trip.krwPer100Jpy
  const krw = (e: Expense) => toKRW(e.amount, e.currency, rate)
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

  const scoped = filter === 'all' ? expenses : itemsOf(filter)
  const total = sum(scoped.map(krw))
  const jpy = sum(scoped.filter((e) => e.currency === 'JPY').map((e) => e.amount))
  const settlement = group ? settle(trip.members, expenses, rate) : null
  const placeOf = (e: Expense) => (e.planId ? plans.find((p) => p.id === e.planId)?.title : '')

  return (
    <>
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-extrabold tracking-tight">여행 비용</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSheet({ kind: 'stats' })}
              aria-label="카테고리별 통계"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-neutral-700 shadow-sm ring-1 ring-neutral-200 active:bg-neutral-50"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v9h9" />
                <circle cx="12" cy="12" r="9" />
              </svg>
            </button>
            {group && (
              <button
                type="button"
                onClick={() => setSheet({ kind: 'settle' })}
                aria-label="1/N 정산"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[13px] font-extrabold text-neutral-800 shadow-sm ring-1 ring-neutral-200 active:bg-neutral-50"
              >
                1/N
              </button>
            )}
          </div>
        </div>

        <div className="mt-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="기간"
            className="rounded-lg bg-white py-2 pl-3 pr-8 text-[13px] font-semibold text-neutral-700 shadow-sm ring-1 ring-neutral-200 outline-none"
          >
            <option value="all">기간 전체</option>
            {sections.map((s) => (
              <option key={s.key} value={s.key}>
                {s.title}
                {s.key !== 'pre' && s.key !== 'post' ? ` · ${s.sub}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className={`${cardCls} mt-3 p-5`}>
          <p className="text-[13px] text-neutral-500">{filter === 'all' ? '총 지출' : `${sections.find((s) => s.key === filter)?.title} 지출`}</p>
          <p className="mt-1 text-[34px] font-extrabold leading-tight tracking-tight">{fmtKRW(total)}</p>
          <p className="mt-1 text-[13px] text-neutral-500">
            엔화 {fmtJPY(jpy)} <span className="text-neutral-300">·</span> 100엔 = {rate.toLocaleString('ko-KR')}원
            {settlement && settlement.total > 0 && (
              <>
                {' '}
                <span className="text-neutral-300">·</span> 1인당 {fmtKRW(settlement.share)}
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
                    group ? (e.shared ? `${e.payer} 결제 · 1/N` : `${e.payer} 개인`) : METHODS.find((m) => m.id === e.method)?.label,
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
      {sheet?.kind === 'settle' && settlement && (
        <Sheet title="1/N 정산" onClose={() => setSheet(null)}>
          <div>
            <p className="text-[13px] text-neutral-500">
              {fmtDay(trip.startDate)} – {fmtDay(trip.endDate)}
            </p>
            <p className="mt-1 text-[21px] font-extrabold leading-snug">
              {trip.name}
              <br />
              정산 내역이에요
            </p>
          </div>
          <div className="border-t border-dashed border-neutral-300" />
          <div>
            <div className="flex justify-between text-[13px] text-neutral-400">
              <span>누가 누구에게</span>
              <span>얼마를</span>
            </div>
            {settlement.transfers.length > 0 ? (
              <ol className="mt-2 space-y-2.5">
                {settlement.transfers.map((t, i) => (
                  <li key={i} className="flex items-center justify-between text-[15px]">
                    <span>
                      <span className="mr-1.5 font-bold" style={{ color: ACCENT }}>
                        {i + 1}.
                      </span>
                      {t.from} → {t.to}
                    </span>
                    <span className="font-bold tabular-nums" style={{ color: ACCENT }}>
                      {fmtKRW(t.amount)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-[15px] text-neutral-500">주고받을 돈이 없어요</p>
            )}
          </div>
          <div className="border-t border-dashed border-neutral-300" />
          <div>
            <p className="text-[13px] text-neutral-400">개인별 지출 금액</p>
            <ul className="mt-2 space-y-3">
              {settlement.people.map((p) => (
                <li key={p.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-2.5 text-[15px] font-medium">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-[13px] font-bold text-neutral-600">
                      {p.name.slice(0, 1)}
                    </span>
                    {p.name}
                  </span>
                  <span className="text-right">
                    <span className="block text-[15px] font-bold tabular-nums">{fmtKRW(settlement.share)}</span>
                    <span className="block text-[12px] tabular-nums text-neutral-400">결제 {fmtKRW(p.paid)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs leading-relaxed text-neutral-400">
            공동 경비 {fmtKRW(settlement.total)}을 {settlement.people.length}명이 똑같이 나눈 금액이에요. "개인 지출"로 적은 건 빠져요.
          </p>
        </Sheet>
      )}
      {sheet?.kind === 'stats' && <StatsSheet expenses={scoped} rate={rate} onClose={() => setSheet(null)} />}
    </>
  )
}

/** 카테고리별 지출 (한 가지 색 막대, 큰 것부터) */
function StatsSheet({ expenses, rate, onClose }: { expenses: Expense[]; rate: number; onClose: () => void }) {
  const krw = (e: Expense) => toKRW(e.amount, e.currency, rate)
  const total = sum(expenses.map(krw))
  const rows = CATEGORIES.map((c) => ({ ...c, value: sum(expenses.filter((e) => e.category === c.id).map(krw)) }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value)
  const max = rows[0]?.value ?? 0
  return (
    <Sheet title="카테고리별 지출" onClose={onClose}>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-400">아직 지출이 없어요</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((c) => (
            <li key={c.id}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 text-neutral-700">
                  <span style={{ color: MINT }}>
                    <CategoryIcon category={c.id} className="h-4 w-4" />
                  </span>
                  {c.label}
                </span>
                <span className="tabular-nums text-neutral-900">
                  {fmtKRW(c.value)}
                  <span className="ml-1.5 text-neutral-400">{Math.round((c.value / total) * 100)}%</span>
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-r-[4px]" style={{ width: `max(2px, ${(c.value / max) * 100}%)`, background: ACCENT }} aria-hidden="true" />
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
