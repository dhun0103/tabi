import type { HTMLAttributes, ReactNode } from 'react'
import { areaLabel, distanceM, fmtDistance, googleLegUrl, hasCoords, placeColor, travelHint } from '../../lib/geo'
import { flightTitle, kindLabel } from '../../lib/util'
import type { Plan } from '../../types'
import { MemoIcon, PlaneIcon } from '../icons'
import { BLUE } from '../ui'
import { useDragSort } from './useDragSort'

interface Props {
  items: Plan[] // 순서대로 정렬된 하루치
  spent?: Map<string, string> // 장소별로 쓴 돈 (예: ¥3,200)
  activeId: string | null
  editing: boolean
  onOpen: (p: Plan) => void
  onFocus: (p: Plan) => void
  /** 편집 중 ≡ 손잡이를 끌어서(또는 손잡이에서 ↑↓ 키로) 순서를 바꿈: 새 순서(id 목록), 옮긴 항목 */
  onReorder: (nextIds: string[], movedId: string) => void
  /** 화면에서 목록이 보이는 위·아래 경계 (끌 때 그 근처에서 저절로 스크롤) */
  edges: () => { top: number; bottom: number }
  onDragChange?: (dragging: boolean) => void
}

/*
 * 왼쪽 세로선 위에 작은 번호 원 + 그 아래 시간 (NOL·트리플처럼), 장소와 장소 사이 선 위에 거리 알약(누르면 그 구간 길찾기)
 * 장소는 사진 없는 흰 카드: 굵은 이름 + "종류 · 동네" 한 줄 (+ 장소 메모는 ≡ 아이콘을 붙여서)
 * 번호 원은 카드 제목 줄, 시간은 카드 둘째 줄과 같은 높이 → 아래 숫자들은 카드 여백·줄 높이에서 나옴
 * 일정 사이 메모는 장소와 같은 흰 카드에 글만 ("메모" 글자 없이) + 선 위 파란 점 (NOL처럼)
 */

const RAIL = 'w-12' // 왼쪽 선 칸 너비
const PAD_TOP = 18 // 줄 위 여백(py-1.5 = 6) + 카드 위 여백(py-3 = 12) = 제목 줄이 시작하는 높이
const TITLE_LH = 22 // 제목 줄 높이 (leading-[22px])
const META_LH = 20 // 둘째 줄 높이 (leading-5)
const CIRCLE_TOP = PAD_TOP + TITLE_LH / 2 // 번호 원 중심 = 제목 줄 가운데
const TIME_TOP = PAD_TOP + TITLE_LH + 2 // 시간 칸 위쪽 = 둘째 줄 위쪽 (mt-0.5)
const TIME_GAP = TIME_TOP + META_LH - CIRCLE_TOP // 시간이 있으면 시간 칸 아래부터 선을 다시 그림
// 장소·메모 공통 흰 카드 (메모 글줄도 제목 줄과 같은 22px라서 메모 점이 번호 원과 같은 높이에 옴)
const CARD = 'block min-w-0 flex-1 rounded-xl bg-white px-4 py-3 text-left shadow-[0_1px_3px_rgba(16,24,40,0.08)] ring-1 ring-black/[0.03] active:bg-neutral-50'

/** 왼쪽 선 칸: 위/아래 반쪽 선 + 가운데 내용 (gap: 가운데 아래로 선을 비울 길이) */
/** 번호 원(또는 비행기) 아래 시간 — 카드 둘째 줄과 같은 높이 */
function RailTime({ time }: { time: string }) {
  return (
    <span
      className="absolute left-1/2 flex -translate-x-1/2 items-center whitespace-nowrap text-[11px] font-semibold tabular-nums leading-none text-neutral-500"
      style={{ top: TIME_TOP, height: META_LH }}
    >
      {time}
    </span>
  )
}

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

export function Timeline({ items, spent, activeId, editing, onOpen, onFocus, onReorder, edges, onDragChange }: Props) {
  const drag = useDragSort(
    items.map((p) => p.id),
    { onDrop: onReorder, edges, onDragChange },
  )
  // 방금 끌어 놓은 순서가 있으면 저장된 데이터가 돌아올 때까지 그 순서로
  const byId = new Map(items.map((p) => [p.id, p]))
  const list = drag.shown.flatMap((id) => byId.get(id) ?? [])
  const rows: ReactNode[] = []
  let n = 0
  let prevPlace: Plan | null = null

  list.forEach((p, idx) => {
    const first = idx === 0
    const last = idx === list.length - 1
    const handle = (label: string) => editing && <DragHandle label={label} {...drag.handleProps(idx)} />

    if (p.type === 'memo') {
      rows.push(
        <li key={p.id} id={`plan-${p.id}`} className="flex">
          <Rail top={!first} bottom={!last}>
            <span className="absolute left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ top: CIRCLE_TOP, background: BLUE }} />
          </Rail>
          <div className="flex min-w-0 flex-1 py-1.5">
            <button type="button" onClick={() => onOpen(p)} aria-label={`메모: ${p.title}`} className={`${CARD} whitespace-pre-wrap wrap-anywhere text-[15px] leading-[22px] text-neutral-800`}>
              {p.title}
            </button>
            {handle(`메모 "${p.title.slice(0, 20)}" 순서 바꾸기`)}
          </div>
        </li>,
      )
      return
    }

    if (p.type === 'flight') {
      // 항공편: 파란 원 안 비행기 + 출발 시간, 카드엔 "ICN 09:10 - NGO 10:55" / "제주항공 · 7C1201" (NOL처럼)
      // 번호를 매기지 않고 거리 계산에서도 빠짐(좌표 없음) → 앞뒤 장소 사이 거리 알약은 그대로 나옴
      const f = p.flight
      const title = f ? flightTitle(f, p.time) : p.title
      const meta = f ? [f.airline, f.number].filter(Boolean).join(' · ') : ''
      rows.push(
        <li key={p.id} id={`plan-${p.id}`} className="flex">
          <Rail top={!first} bottom={!last} gap={p.time ? TIME_GAP : 0}>
            {p.time && <RailTime time={p.time} />}
            <span
              className="absolute left-1/2 z-10 flex h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white ring-2 ring-white"
              style={{ top: CIRCLE_TOP, background: BLUE }}
              aria-hidden="true"
            >
              <PlaneIcon className="h-3.5 w-3.5 rotate-45" />
            </span>
          </Rail>
          <div className="flex min-w-0 flex-1 py-1.5">
            <button type="button" onClick={() => onOpen(p)} aria-label={`항공편: ${title}${meta ? `, ${meta}` : ''}`} className={CARD}>
              <span className="block truncate text-[16px] font-bold leading-[22px] text-neutral-900">{title}</span>
              {(meta || p.time) && <span className="mt-0.5 block truncate text-[13px] leading-5 text-neutral-500">{meta || ' '}</span>}
            </button>
            {handle(`항공편 ${title} 순서 바꾸기`)}
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
    const meta = [kindLabel(p.kind), areaLabel(p)].filter(Boolean).join(' · ') || (pinned ? '' : '지도 위치 없음')
    const money = spent?.get(p.id)
    const active = p.id === activeId
    // 첫 줄 위쪽 선은 앞에 메모가 있을 때만, 아래쪽 선은 뒤에 뭔가 있을 때만
    rows.push(
      <li key={p.id} id={`plan-${p.id}`} className={`-mx-4 flex px-4 transition-colors ${active ? 'bg-[#ECF4FF]' : ''}`}>
        <Rail top={!first} bottom={!last} gap={p.time ? TIME_GAP : 0}>
          {p.time && <RailTime time={p.time} />}
          <button
            type="button"
            onClick={() => pinned && onFocus(p)}
            aria-label={pinned ? `${num}번 ${p.title} 지도에서 보기` : `${num}번 (지도 위치 없음)`}
            className="absolute left-1/2 z-10 flex h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[12px] font-bold ring-2 ring-white"
            style={{
              top: CIRCLE_TOP,
              // 장소 종류별 색 (음식점 코랄 · 숙소 민트 · 나머지 보라). 지도 위치가 없어도 같은 색 (NOL처럼)
              background: placeColor(p.kind).bg,
              color: placeColor(p.kind).ink,
            }}
          >
            {num}
          </button>
        </Rail>
        <div className="flex min-w-0 flex-1 py-1.5">
          <button type="button" onClick={() => onOpen(p)} className={CARD}>
            <span className="flex items-start gap-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-bold leading-[22px] text-neutral-900">{p.title}</span>
                {/* 시간이 있으면 둘째 줄 자리를 비워 두더라도 남겨서 시간이 카드 안에 오게 */}
                {(meta || p.time) && <span className="mt-0.5 block truncate text-[13px] leading-5 text-neutral-500">{meta || '\u00a0'}</span>}
              </span>
              {money && <span className="shrink-0 pt-0.5 text-[13px] font-semibold tabular-nums text-neutral-700">{money}</span>}
            </span>
            {p.memo && (
              // 장소 메모: ≡ 아이콘으로 메모인 걸 표시 (NOL처럼), 종류·동네보다 진하게
              // 길어도 줄이지 않고 끝까지 (카드를 누르지 않고 목록에서 바로 읽게). 긴 주소·링크는 카드 안에서 줄바꿈
              <span className="mt-2 flex items-start gap-1.5 text-[13px] font-medium leading-5 text-neutral-700">
                <MemoIcon className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                <span className="min-w-0 whitespace-pre-wrap wrap-anywhere">{p.memo}</span>
              </span>
            )}
          </button>
          {handle(`${num}번 ${p.title} 순서 바꾸기`)}
        </div>
      </li>,
    )
    prevPlace = p
  })

  return <ol ref={drag.listRef}>{rows}</ol>
}

/**
 * 편집 중 카드 오른쪽 ≡ 손잡이: 잡고 위아래로 끌어서 순서 바꾸기 (NOL처럼)
 * touch-none: 손잡이에서 시작한 손가락은 화면 스크롤 대신 끌기로. 초점이 있으면 ↑↓ 키로 한 칸씩
 */
function DragHandle({ label, ...rest }: { label: string } & Pick<HTMLAttributes<HTMLButtonElement>, 'onPointerDown' | 'onKeyDown'>) {
  return (
    <button
      type="button"
      aria-label={`${label} (끌거나 위아래 화살표 키)`}
      title="끌어서 순서 바꾸기"
      {...rest}
      className="ml-1 flex w-10 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-lg text-neutral-400 active:cursor-grabbing active:text-neutral-600"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
        <path d="M5 8h14M5 12h14M5 16h14" />
      </svg>
    </button>
  )
}
