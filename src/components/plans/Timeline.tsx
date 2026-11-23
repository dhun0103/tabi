import type { ReactNode } from 'react'
import { distanceM, fmtDistance, googleLegUrl, hasCoords, travelHint } from '../../lib/geo'
import type { Plan } from '../../types'

interface Props {
  items: Plan[] // 순서대로 정렬된 하루치
  color: { bg: string; ink: string }
  spent?: Map<string, string> // 장소별로 쓴 돈 (예: ¥3,200)
  activeId: string | null
  editing: boolean
  onOpen: (p: Plan) => void
  onFocus: (p: Plan) => void
  onMove: (index: number, delta: -1 | 1) => void
}

/*
 * 왼쪽 세로선 위에 작은 번호 원 + 그 아래 시간 (NOL·트리플처럼), 장소와 장소 사이 선 위에 거리 알약(누르면 그 구간 길찾기)
 * 장소는 사진 없는 흰 카드: 굵은 이름 + "종류 · 동네" 한 줄
 */

const RAIL = 'w-12' // 왼쪽 선 칸 너비
const CIRCLE_TOP = 18 // 번호 원 중심 높이(px) = 카드 제목 줄
const TIME_TOP = 32 // 시간 글자 위쪽 (번호 원 바로 아래)
const TIME_GAP = 32 // 시간이 있으면 아래 선을 이만큼 띄워서 글자와 겹치지 않게

/** 왼쪽 선 칸: 위/아래 반쪽 선 + 가운데 내용 (gap: 가운데 아래로 선을 비울 길이) */
function Rail(props: { top: boolean; bottom: boolean; center?: number; gap?: number; children?: ReactNode }) {
  const c = props.center ?? CIRCLE_TOP
  return (
    <div className={`relative ${RAIL} shrink-0`}>
      {props.top && <span className="absolute left-1/2 top-0 w-px -translate-x-1/2 bg-neutral-300" style={{ height: c }} />}
      {props.bottom && <span className="absolute bottom-0 left-1/2 w-px -translate-x-1/2 bg-neutral-300" style={{ top: c + (props.gap ?? 0) }} />}
      {props.children}
    </div>
  )
}

export function Timeline({ items, color, spent, activeId, editing, onOpen, onFocus, onMove }: Props) {
  const rows: ReactNode[] = []
  let n = 0
  let prevPlace: Plan | null = null

  items.forEach((p, idx) => {
    const first = idx === 0
    const last = idx === items.length - 1
    const arrows = editing && (
      <div className="flex shrink-0 flex-col justify-center gap-1 pl-2">
        <ArrowButton label="위로" disabled={idx === 0} onClick={() => onMove(idx, -1)} d="M6 15l6-6 6 6" />
        <ArrowButton label="아래로" disabled={last} onClick={() => onMove(idx, 1)} d="M6 9l6 6 6-6" />
      </div>
    )

    if (p.type === 'memo') {
      rows.push(
        <li key={p.id} id={`plan-${p.id}`} className="flex">
          <Rail top={!first} bottom={!last} center={22}>
            <span className="absolute left-1/2 top-[18px] h-2 w-2 -translate-x-1/2 rounded-full bg-neutral-300" />
          </Rail>
          <div className="flex min-w-0 flex-1 py-1.5">
            <button
              type="button"
              onClick={() => onOpen(p)}
              className="min-w-0 flex-1 whitespace-pre-wrap rounded-xl border border-dashed border-neutral-300 bg-white/60 px-4 py-2.5 text-left text-[13px] leading-relaxed text-neutral-600"
            >
              <span className="mr-1.5 font-semibold text-neutral-800">메모</span>
              {p.title}
            </button>
            {arrows}
          </div>
        </li>,
      )
      return
    }

    // 앞 장소와의 거리 알약 (선 위). 누르면 그 구간 길찾기
    if (prevPlace && !editing && hasCoords(prevPlace) && hasCoords(p)) {
      const d = distanceM(prevPlace, p)
      rows.push(
        <li key={`leg-${p.id}`} className="flex h-8">
          <Rail top bottom center={16}>
            <a
              href={googleLegUrl(prevPlace, p)}
              target="_blank"
              rel="noopener noreferrer"
              title={`${travelHint(d)} · 누르면 길찾기`}
              aria-label={`${prevPlace.title}에서 ${p.title}까지 ${travelHint(d)}, 길찾기`}
              className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-neutral-300 bg-white px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-neutral-500 active:bg-neutral-100"
            >
              {fmtDistance(d)}
            </a>
          </Rail>
          <div className="flex-1" />
        </li>,
      )
    }

    n += 1
    const num = n
    const pinned = hasCoords(p)
    const meta = [p.kind, p.area].filter(Boolean).join(' · ') || (pinned ? '' : '지도 위치 없음')
    const money = spent?.get(p.id)
    const active = p.id === activeId
    // 첫 줄 위쪽 선은 앞에 메모가 있을 때만, 아래쪽 선은 뒤에 뭔가 있을 때만
    rows.push(
      <li key={p.id} id={`plan-${p.id}`} className={`-mx-4 flex px-4 transition-colors ${active ? 'bg-[#ECF4FF]' : ''}`}>
        <Rail top={!first} bottom={!last} gap={p.time ? TIME_GAP : 0}>
          {p.time && (
            <span
              className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold tabular-nums leading-none text-neutral-500"
              style={{ top: TIME_TOP }}
            >
              {p.time}
            </span>
          )}
          <button
            type="button"
            onClick={() => pinned && onFocus(p)}
            aria-label={pinned ? `${num}번 ${p.title} 지도에서 보기` : `${num}번 (지도 위치 없음)`}
            className="absolute left-1/2 z-10 flex h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[12px] font-bold ring-2 ring-white"
            style={{
              top: CIRCLE_TOP,
              ...(pinned ? { background: color.bg, color: color.ink } : { background: '#d4d4d8', color: '#52525b' }),
            }}
          >
            {num}
          </button>
        </Rail>
        <div className="flex min-w-0 flex-1 py-1.5">
          <button
            type="button"
            onClick={() => onOpen(p)}
            className="block min-w-0 flex-1 rounded-xl bg-white px-4 py-3 text-left shadow-[0_1px_3px_rgba(16,24,40,0.08)] ring-1 ring-black/[0.03] active:bg-neutral-50"
          >
            <span className="flex items-start gap-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-bold leading-snug text-neutral-900">{p.title}</span>
                {meta && <span className="mt-0.5 block truncate text-[13px] text-neutral-500">{meta}</span>}
              </span>
              {money && <span className="shrink-0 pt-0.5 text-[13px] font-semibold tabular-nums text-neutral-700">{money}</span>}
            </span>
            {p.memo && <span className="mt-1.5 line-clamp-2 block whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-500">{p.memo}</span>}
          </button>
          {arrows}
        </div>
      </li>,
    )
    prevPlace = p
  })

  return <ol>{rows}</ol>
}

function ArrowButton(props: { label: string; disabled: boolean; onClick: () => void; d: string }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-neutral-600 shadow-sm ring-1 ring-neutral-200 active:bg-neutral-100 disabled:opacity-25"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d={props.d} />
      </svg>
    </button>
  )
}
