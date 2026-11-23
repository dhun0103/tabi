import { useEffect, useRef, useState } from 'react'
import { CATEGORIES, expenseKRW, fmtKRW } from '../../lib/util'
import type { Category, Expense } from '../../types'
import { cardCls } from '../ui'

/**
 * 카테고리 색 (원그래프 칸 · 막대 · 점). 색은 순위가 아니라 카테고리를 따라감 → 기간을 바꿔도 같은 카테고리는 같은 색
 * 원그래프는 큰 순서라 어느 두 칸이든 붙을 수 있음 → 다섯 색을 "모든 쌍"으로 계산해 확인 (흰 카드 위):
 *   색약 시뮬레이션 ΔE ≥ 13.6, 일반 시야 ΔE ≥ 19.6 (OKLab ×100, 기준 8 / 15)
 * 기타는 일부러 회색("그 밖의 것"), 다른 색들과도 색약 ΔE 9.2 · 일반 16.9로 구분됨
 * 노랑·분홍·회색은 흰 바탕 대비가 3:1보다 낮아서, 이름·금액·비율을 항상 글자로 같이 보여 줌
 */
const COLOR: Record<Category, string> = {
  food: '#eda100',
  transport: '#2F87F2',
  shopping: '#e87ba4',
  lodging: '#60427e',
  sights: '#008300',
  etc: '#c2c2c2',
}

export interface Period {
  value: string
  label: string
}

/** 가계부와 이 페이지가 같이 쓰는 기간 고르기 */
export function PeriodSelect(props: { periods: Period[]; value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      aria-label="기간"
      className="rounded-lg bg-white py-2 pl-3 pr-8 text-[13px] font-semibold text-neutral-700 shadow-sm ring-1 ring-neutral-200 outline-none"
    >
      {props.periods.map((p) => (
        <option key={p.value} value={p.value}>
          {p.label}
        </option>
      ))}
    </select>
  )
}

interface Props {
  expenses: Expense[] // 고른 기간의 지출
  rate: number // 여행 기본 환율 (환율이 저장 안 된 예전 지출에만 쓰임)
  periods: Period[]
  period: string
  onPeriod: (v: string) => void
  onClose: () => void
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

/**
 * 카테고리별 지출 상세 페이지 (화면 전체): 위에 원그래프, 아래에 카테고리 목록(금액 · 비율 · 막대)
 * 원그래프 칸이나 목록 줄을 누르면 그 카테고리가 가운데에 크게 나오고, 다시 누르면 전체로
 * 뒤로: 왼쪽 위 화살표 · 휴대폰 뒤로 가기 · Esc
 */
export function CategoryPage({ expenses, rate, periods, period, onPeriod, onClose }: Props) {
  const [picked, setPicked] = useState<Category | null>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  // 열 때 방문 기록을 하나 쌓아서, 휴대폰 뒤로 가기를 누르면 앱이 아니라 이 페이지만 닫히게
  const back = () => (history.state?.tabiPage ? history.back() : closeRef.current())
  useEffect(() => {
    if (!history.state?.tabiPage) history.pushState({ tabiPage: 'categories' }, '')
    const onPop = () => closeRef.current()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && back()
    window.addEventListener('popstate', onPop)
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [])

  const krw = (e: Expense) => expenseKRW(e, rate)
  const total = sum(expenses.map(krw))
  const rows = CATEGORIES.map((c) => ({ ...c, value: sum(expenses.filter((e) => e.category === c.id).map(krw)) }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value)
  const max = rows[0]?.value ?? 0
  const sel = rows.find((r) => r.id === picked) ?? null // 기간을 바꿔서 고른 카테고리가 없어지면 전체로
  const pct = (v: number) => {
    const p = (v / total) * 100
    return p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`
  }
  const toggle = (id: Category) => setPicked((cur) => (cur === id ? null : id))

  const big = fmtKRW(sel ? sel.value : total)

  return (
    <div role="dialog" aria-modal="true" aria-label="카테고리별 지출" className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-[#f4f5f8] text-neutral-900">
      <header className="sticky top-0 z-10 border-b border-neutral-200/60 bg-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex h-14 max-w-lg items-center gap-1 px-2">
          <button type="button" onClick={back} aria-label="뒤로" className="rounded-full p-2 text-neutral-800 active:bg-neutral-100">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <h2 className="text-[18px] font-bold">카테고리별 지출</h2>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 pt-4" style={{ paddingBottom: 'calc(32px + env(safe-area-inset-bottom))' }}>
        <PeriodSelect periods={periods} value={period} onChange={onPeriod} />

        <section className={`${cardCls} mt-3 px-5 pb-4 pt-6`}>
          <div
            role="img"
            aria-label={rows.length ? `원그래프: ${rows.map((r) => `${r.label} ${pct(r.value)}`).join(', ')}` : '원그래프: 지출 없음'}
            className="relative mx-auto h-[196px] w-[196px]"
          >
            <Donut rows={rows} total={total} picked={sel?.id ?? null} onPick={toggle} />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[13px] text-neutral-500">{sel ? sel.label : '총 지출'}</span>
              <span className={`mt-0.5 font-extrabold tracking-tight ${big.length >= 10 ? 'text-[18px]' : 'text-[21px]'}`}>{big}</span>
              {sel && <span className="mt-0.5 text-[13px] font-semibold text-neutral-500">{pct(sel.value)}</span>}
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="pb-2 pt-6 text-center text-sm text-neutral-400">이 기간엔 아직 지출이 없어요</p>
          ) : (
            <ul className="mt-6">
              {rows.map((c) => {
                const on = sel?.id === c.id
                return (
                  <li key={c.id} className="-mx-2">
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(c.id)}
                      className={`w-full rounded-xl px-2 py-2.5 text-left transition-colors ${on ? 'bg-neutral-100' : 'active:bg-neutral-50'}`}
                    >
                      <span className="flex items-center justify-between gap-2 text-[15px]">
                        <span className="flex min-w-0 items-center gap-2.5 font-medium text-neutral-800">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLOR[c.id] }} aria-hidden="true" />
                          <span className="truncate">{c.label}</span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">
                          {fmtKRW(c.value)}
                          <span className="ml-1.5 inline-block w-9 text-right text-[13px] font-normal text-neutral-400">{pct(c.value)}</span>
                        </span>
                      </span>
                      <span
                        className="mt-2 block h-2 rounded-r-[4px] transition-opacity"
                        style={{ width: `max(2px, ${(c.value / max) * 100}%)`, background: COLOR[c.id], opacity: sel && !on ? 0.3 : 1 }}
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

/* ───────── 원그래프 (가운데가 빈 도넛) ───────── */

const C = 100 // viewBox 200 × 200의 가운데
const R_OUT = 92
const R_IN = 64
const POP = 5 // 고른 칸은 바깥으로 이만큼 튀어나옴
const GAP = 2 // 칸 사이 흰 틈 (두께가 어디서나 같게)
const MIN_ANGLE = 0.045 // 아주 작은 칸(1% 미만)도 틈에 묻히지 않고 가는 조각으로 보이게 하는 최소 각도 (약 2.6°)

/** 칸마다 각도. 최소 각도보다 작은 칸은 최소 각도로 키우고, 그만큼 나머지 칸을 같은 비율로 줄임 */
function angles(values: number[], total: number) {
  const raw = values.map((v) => (v / total) * 2 * Math.PI)
  const tiny = raw.map((a) => a < MIN_ANGLE)
  const rest = raw.reduce((s, a, i) => s + (tiny[i] ? 0 : a), 0)
  const scale = (2 * Math.PI - tiny.filter(Boolean).length * MIN_ANGLE) / rest
  return raw.map((a, i) => (tiny[i] ? MIN_ANGLE : a * scale))
}

/** 도넛 한 칸: 12시 방향이 0, 시계 방향. 양쪽 끝을 GAP/2씩 평행하게 깎아 틈을 만든다 */
function sector(a0: number, a1: number, rOut: number, rIn: number) {
  const cut = (r: number) => Math.asin(Math.min(1, GAP / 2 / r))
  let [o0, o1] = [a0 + cut(rOut), a1 - cut(rOut)]
  let [i0, i1] = [a0 + cut(rIn), a1 - cut(rIn)]
  if (o1 < o0) o0 = o1 = (a0 + a1) / 2 // 아주 작은 칸은 뾰족한 조각으로
  if (i1 < i0) i0 = i1 = (a0 + a1) / 2
  const pt = (r: number, a: number) => `${(C + r * Math.sin(a)).toFixed(2)} ${(C - r * Math.cos(a)).toFixed(2)}`
  const large = (from: number, to: number) => (to - from > Math.PI ? 1 : 0)
  return `M${pt(rOut, o0)}A${rOut} ${rOut} 0 ${large(o0, o1)} 1 ${pt(rOut, o1)}L${pt(rIn, i1)}A${rIn} ${rIn} 0 ${large(i0, i1)} 0 ${pt(rIn, i0)}Z`
}

function Donut(props: { rows: { id: Category; value: number }[]; total: number; picked: Category | null; onPick: (id: Category) => void }) {
  const { rows, total, picked, onPick } = props
  const ring = (R_OUT + R_IN) / 2
  if (rows.length <= 1) {
    // 한 카테고리뿐이면(또는 지출이 없으면) 끊김 없는 고리
    const only = rows[0]
    return (
      <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden="true">
        <circle
          cx={C}
          cy={C}
          r={ring}
          fill="none"
          stroke={only ? COLOR[only.id] : '#eeeeee'}
          strokeWidth={R_OUT - R_IN}
          onClick={only ? () => onPick(only.id) : undefined}
          className={only ? 'cursor-pointer' : ''}
        />
      </svg>
    )
  }
  const sizes = angles(
    rows.map((r) => r.value),
    total,
  )
  let a = 0
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full [-webkit-tap-highlight-color:transparent]" aria-hidden="true">
      {rows.map((r, i) => {
        const a0 = a
        a += sizes[i]
        const on = picked === r.id
        return (
          <path
            key={r.id}
            d={sector(a0, a, on ? R_OUT + POP : R_OUT, R_IN)}
            fill={COLOR[r.id]}
            opacity={picked && !on ? 0.3 : 1}
            onClick={() => onPick(r.id)}
            className="cursor-pointer transition-opacity"
          />
        )
      })}
    </svg>
  )
}
