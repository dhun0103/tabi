import { useEffect, useRef, useState } from 'react'
import { useBackClose } from '../../lib/backstack'
import { CATEGORIES, expenseKRW, fmtKRW } from '../../lib/util'
import type { Category, Expense, Trip } from '../../types'
import { CategoryIcon } from '../icons'
import { BLUE } from '../ui'
import { PeriodSelect, type Period } from './PeriodSelect'

/**
 * 카테고리 색 (원그래프 칸 · 아이콘 · 오른쪽 작은 막대). 색은 순위가 아니라 카테고리를 따라감 → 기간을 바꿔도 같은 색
 * 원그래프는 큰 순서라 어느 두 칸이든 붙을 수 있음 → 6색 모든 쌍을 계산해 고름 (흰 바탕):
 *   색약 시뮬레이션 ΔE ≥ 11.3, 일반 시야 ΔE ≥ 16.6 (OKLab ×100, 기준 8 / 15). 파랑·민트는 앱의 버튼·아이콘 색
 * 기타는 일부러 회색("그 밖의 것"). 노랑·회색은 흰 바탕 대비 3:1보다 낮아서 이름·금액·비율을 항상 글자로 같이 보여 줌
 */
const COLOR: Record<Category, string> = {
  lodging: '#5B3FD6',
  food: '#F59E0B',
  shopping: '#F04452',
  transport: '#2F87F2',
  sights: '#0E9A90',
  etc: '#B0B8C1',
}

interface Props {
  trip: Trip
  expenses: Expense[] // 고른 기간의 지출
  periods: Period[]
  period: string
  onPeriod: (v: string) => void
  onClose: () => void
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

/** 트리플 영수증 느낌의 점선 */
const Dashed = () => (
  <div aria-hidden="true" className="h-px" style={{ backgroundImage: 'linear-gradient(to right, #D5DAE0 50%, transparent 50%)', backgroundSize: '8px 1px' }} />
)

/**
 * 카테고리별 지출 페이지 (트리플 "지출내역" 구성 + 원그래프)
 *   큰 제목(여행 이름 · 지출내역입니다.) → 총 지출 금액(+ 기간 고르기) → "○○에서 가장 많이 썼어요." + 원그래프 → 카테고리 목록
 *   목록 줄이나 원그래프 칸을 누르면 그 카테고리를 강조 (문장·가운데 비율도 바뀜), 다시 누르면 처음으로
 *   제목이 위로 지나가면 위 막대에 여행 이름이 작게 나옴. 닫기: ✕ · 휴대폰 뒤로 가기 · Esc
 */
export function CategoryPage({ trip, expenses, periods, period, onPeriod, onClose }: Props) {
  const [picked, setPicked] = useState<Category | null>(null)
  const [compact, setCompact] = useState(false)
  const titleRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  // 휴대폰 뒤로 가기를 누르면 앱이 아니라 이 페이지만 닫히게 (다른 창들과 같은 방식)
  useBackClose(onClose)
  const back = () => closeRef.current()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [])

  const krw = (e: Expense) => expenseKRW(e, trip.krwPer100Jpy)
  const total = sum(expenses.map(krw))
  const rows = CATEGORIES.map((c) => ({ ...c, value: sum(expenses.filter((e) => e.category === c.id).map(krw)) }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value)
  const max = rows[0]?.value ?? 0
  const sel = rows.find((r) => r.id === picked) ?? null // 기간을 바꿔서 고른 카테고리가 없어지면 처음으로
  const focus = sel ?? rows[0] // 원그래프 가운데에 보여 줄 카테고리
  const pct = (v: number) => {
    const p = (v / total) * 100
    return p >= 99.95 ? '100%' : p < 0.1 ? '<0.1%' : `${p.toFixed(1)}%`
  }
  const toggle = (id: Category) => setPicked((cur) => (cur === id ? null : id))

  const headline = sel ? [`${sel.label}에`, `${fmtKRW(sel.value)} 썼어요.`] : rows.length === 1 ? ['모두', `${rows[0].label}에 썼어요.`] : [`${rows[0]?.label}에서`, '가장 많이 썼어요.']

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="카테고리별 지출"
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-white text-neutral-900"
      onScroll={(e) => {
        const next = e.currentTarget.scrollTop > (titleRef.current?.offsetHeight ?? 120) - 8
        if (next !== compact) setCompact(next)
      }}
    >
      <header className={`sticky top-0 z-10 bg-white ${compact ? 'shadow-[0_1px_0_#EEF0F3]' : ''}`} style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex h-14 max-w-lg items-center gap-1 px-3">
          <button type="button" onClick={back} aria-label="닫기" className="rounded-full p-2 text-neutral-800 active:bg-neutral-100">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          {/* 큰 제목이 위로 지나가면 여기 작게 (트리플처럼) */}
          <p className={`min-w-0 truncate text-[16px] font-bold transition-opacity duration-200 ${compact ? 'opacity-100' : 'opacity-0'}`} aria-hidden={!compact}>
            {trip.name}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-6" style={{ paddingBottom: 'calc(40px + env(safe-area-inset-bottom))' }}>
        <div ref={titleRef} className="pb-7 pt-3">
          <h2 className="text-[24px] font-bold leading-[1.42] tracking-tight">
            {trip.name}
            <br />
            지출내역입니다.
          </h2>
        </div>

        <Dashed />
        <section className="py-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[14px] text-neutral-500">총 지출 금액</p>
            <PeriodSelect periods={periods} value={period} onChange={onPeriod} variant="line" align="right" />
          </div>
          <p className="mt-2 text-[30px] font-bold tracking-tight">
            <span style={{ color: BLUE }}>{fmtKRW(total).slice(0, -1)}</span>원
          </p>
        </section>
        <Dashed />

        {rows.length === 0 ? (
          <p className="py-12 text-center text-[14px] text-neutral-400">이 기간엔 아직 지출이 없어요</p>
        ) : (
          <>
            <section className="flex items-center justify-between gap-4 py-6">
              <p className="min-w-0 text-[20px] font-bold leading-[1.4] tracking-tight" aria-live="polite">
                {headline[0]}
                <br />
                {headline[1]}
              </p>
              <div
                role="img"
                aria-label={`원그래프: ${rows.map((r) => `${r.label} ${pct(r.value)}`).join(', ')}`}
                className="relative aspect-square w-[clamp(112px,34vw,136px)] shrink-0"
              >
                <Donut rows={rows} total={total} picked={sel?.id ?? null} onPick={toggle} />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[12px] leading-tight text-neutral-500">{focus.label}</span>
                  <span className="text-[17px] font-bold leading-tight">{pct(focus.value)}</span>
                </div>
              </div>
            </section>
            <Dashed />

            <ul className="py-3">
              {rows.map((c) => {
                const on = sel?.id === c.id
                const dim = sel !== null && !on
                return (
                  <li key={c.id} className="-mx-3">
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(c.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left transition-colors ${on ? 'bg-[#F4F6F9]' : 'active:bg-neutral-50'}`}
                    >
                      <span className="shrink-0 transition-opacity" style={{ color: COLOR[c.id], opacity: dim ? 0.35 : 1 }}>
                        <CategoryIcon category={c.id} className="h-[22px] w-[22px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px] font-bold leading-snug">{c.label}</span>
                        <span className="block text-[13px] tabular-nums leading-snug text-neutral-400">{fmtKRW(c.value)}</span>
                      </span>
                      <span className="shrink-0 text-[16px] font-bold tabular-nums">{pct(c.value)}</span>
                      {/* 비율 막대: 가장 큰 카테고리가 40px (트리플처럼 오른쪽 끝에 짧게) */}
                      <span className="flex w-10 shrink-0 justify-end" aria-hidden="true">
                        <span
                          className="block h-6 rounded-[4px] transition-opacity"
                          style={{ width: `${Math.max(4, (c.value / max) * 40)}px`, background: COLOR[c.id], opacity: dim ? 0.3 : 1 }}
                        />
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

/* ───────── 원그래프 (가운데가 빈 얇은 고리) ───────── */

const C = 100 // viewBox 200 × 200의 가운데
const R_OUT = 92
const R_IN = 74
const POP = 5 // 고른 칸은 바깥으로 이만큼 튀어나옴
const GAP = 3.2 // 칸 사이 흰 틈 (화면에서 약 2px, 두께가 어디서나 같게)
const MIN_ANGLE = 0.06 // 아주 작은 칸(1% 미만)도 틈에 묻히지 않고 가는 조각으로 보이게 하는 최소 각도 (약 3.4°)

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
  if (rows.length === 1) {
    // 한 카테고리뿐이면 끊김 없는 고리
    const only = rows[0]
    return (
      <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden="true">
        <circle cx={C} cy={C} r={(R_OUT + R_IN) / 2} fill="none" stroke={COLOR[only.id]} strokeWidth={R_OUT - R_IN} onClick={() => onPick(only.id)} className="cursor-pointer" />
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
