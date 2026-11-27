import { useRef, useState, type HTMLAttributes, type ReactNode } from 'react'
import { areaLabel, distanceM, fmtDistance, googleLegUrl, googleSpotUrl, hasCoords, placeColor, travelHint } from '../../lib/geo'
import { flightTitle, kindLabel } from '../../lib/util'
import type { Plan, SubSpot } from '../../types'
import { CheckCircleIcon, ExternalIcon, MemoIcon, PencilIcon, PlaneIcon } from '../icons'
import { BLUE } from '../ui'
import { useDragSort } from './useDragSort'

interface Props {
  items: Plan[] // 순서대로 정렬된 하루치
  spent?: Map<string, string> // 장소별로 쓴 돈 (예: ¥3,200)
  activeId: string | null // 장소 id, 또는 들를 곳이면 "장소id:들를곳id"
  editing: boolean
  onOpen: (p: Plan) => void
  onFocus: (p: Plan) => void
  /** 들를 곳을 펼친 장소들 (펼치면 카드 아래에 목록, 지도엔 작은 점) */
  expanded: Set<string>
  onToggleExpand: (p: Plan) => void
  onToggleSpot: (p: Plan, spotId: string) => void // 다녀옴 체크
  onFocusSpot: (p: Plan, s: SubSpot) => void // 지도에서 그 점으로
  /** 편집 중 들를 곳을 그 장소 안에서 끌어서(또는 ↑↓ 키로) 순서 바꾸기: 새 순서(들를 곳 id 목록) */
  onReorderSpots: (p: Plan, nextIds: string[]) => void
  /** 편집 중 들를 곳 이름을 누르면 그 자리에서 이름만 고치기 */
  onRenameSpot: (p: Plan, spotId: string, title: string) => void
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
const CARD_BOX = 'min-w-0 flex-1 rounded-xl bg-white shadow-[0_1px_3px_rgba(16,24,40,0.08)] ring-1 ring-black/[0.03]'
const CARD = `block ${CARD_BOX} px-4 py-3 text-left active:bg-neutral-50`

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

export function Timeline({
  items,
  spent,
  activeId,
  editing,
  onOpen,
  onFocus,
  expanded,
  onToggleExpand,
  onToggleSpot,
  onFocusSpot,
  onReorderSpots,
  onRenameSpot,
  onReorder,
  edges,
  onDragChange,
}: Props) {
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
    const active = p.id === activeId || !!activeId?.startsWith(`${p.id}:`) // 들를 곳을 골라도 그 장소 줄을 강조
    // 들를 곳: 평소엔 카드 안 알약으로 접었다 폈다, 편집 중엔 알약 없이 늘 펼쳐서 ≡ 로 그 안에서 순서 바꾸기
    const allSpots = p.spots ?? []
    const spots = editing ? [] : allSpots
    const open = spots.length > 0 && expanded.has(p.id)
    const content = (
      <>
        <span className="flex items-start gap-2">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-bold leading-[22px] text-neutral-900">{p.title}</span>
            {/* 시간이 있으면 둘째 줄 자리를 비워 두더라도 남겨서 시간이 카드 안에 오게 */}
            {(meta || p.time) && <span className="mt-0.5 block truncate text-[13px] leading-5 text-neutral-500">{meta || ' '}</span>}
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
      </>
    )
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
        <div className="min-w-0 flex-1 py-1.5">
          <div className="flex">
            {spots.length > 0 ? (
              // 들를 곳이 있으면: 카드 안 아래에 "들를 곳 N" 알약 (누르면 카드 아래에 펼침, 일정 흐름엔 안 나옴)
              <div className={CARD_BOX}>
                <button type="button" onClick={() => onOpen(p)} className="block w-full rounded-t-xl px-4 pb-2 pt-3 text-left active:bg-neutral-50">
                  {content}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleExpand(p)}
                  aria-expanded={open}
                  className={`mb-3 ml-4 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                    open ? 'bg-[#E6F0FE] text-[#1F6FD6]' : 'bg-neutral-100 text-neutral-500 active:bg-neutral-200'
                  }`}
                >
                  들를 곳 {spots.length}
                  <svg
                    viewBox="0 0 24 24"
                    className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => onOpen(p)} className={CARD}>
                {content}
              </button>
            )}
            {handle(`${num}번 ${p.title} 순서 바꾸기`)}
          </div>
          {open && <SpotList parent={p} spots={spots} activeId={activeId} onToggle={onToggleSpot} onFocus={onFocusSpot} />}
          {editing && allSpots.length > 0 && (
            <SpotEditList
              parent={p}
              spots={allSpots}
              onReorder={onReorderSpots}
              onRename={onRenameSpot}
              edges={edges}
              onDragChange={onDragChange}
            />
          )}
        </div>
      </li>,
    )
    prevPlace = p
  })

  return <ol ref={drag.listRef}>{rows}</ol>
}

/**
 * 펼친 들를 곳: 카드 아래 왼쪽 세로선에 붙은 작은 목록 (번호 없음)
 *   동그라미 = 다녀옴 체크 · 이름 = 지도에서 그 점으로 · ↗ = 구글맵에서 보기
 */
function SpotList(props: {
  parent: Plan
  spots: SubSpot[]
  activeId: string | null
  onToggle: (p: Plan, spotId: string) => void
  onFocus: (p: Plan, s: SubSpot) => void
}) {
  const { parent, spots, activeId } = props
  return (
    <ul className="ml-3 mt-1.5 border-l-2 border-neutral-200 pl-1">
      {spots.map((s) => {
        const url = googleSpotUrl(s)
        const meta = [kindLabel(s.kind), s.memo].filter(Boolean).join(' · ')
        const on = activeId === `${parent.id}:${s.id}`
        return (
          <li key={s.id} className="flex items-center">
            <button
              type="button"
              role="checkbox"
              aria-checked={s.done}
              aria-label={`${s.title} 다녀옴`}
              onClick={() => props.onToggle(parent, s.id)}
              className="flex h-11 w-10 shrink-0 items-center justify-center"
            >
              <CheckCircleIcon checked={s.done} />
            </button>
            <button type="button" onClick={() => props.onFocus(parent, s)} className="min-w-0 flex-1 py-1.5 text-left">
              <span className={`block truncate text-[14px] font-semibold ${s.done ? 'text-neutral-400 line-through' : on ? 'text-[#1F6FD6]' : 'text-neutral-800'}`}>
                {s.title}
              </span>
              {meta && <span className="block truncate text-[12px] text-neutral-400">{meta}</span>}
            </button>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${s.title} 구글맵에서 보기`}
                className="flex h-11 w-10 shrink-0 items-center justify-center text-neutral-400 active:text-neutral-600"
              >
                <ExternalIcon />
              </a>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * 편집 중 카드 오른쪽 ≡ 손잡이: 잡고 위아래로 끌어서 순서 바꾸기 (NOL처럼)
 * touch-none: 손잡이에서 시작한 손가락은 화면 스크롤 대신 끌기로. 초점이 있으면 ↑↓ 키로 한 칸씩
 */
/**
 * 편집 중 들를 곳: 늘 펼쳐서 보여 주고, 오른쪽 ≡ 로 그 장소 안에서만 위아래로 끌어서 순서 바꾸기
 * (큰 장소의 ≡ 를 끌면 들를 곳 목록째 같이 움직임)
 * 이름(✎)을 누르면 그 자리에서 이름만 고치기: Enter·다른 곳 누르면 저장, Esc 는 취소, 비우면 그대로
 */
function SpotEditList(props: {
  parent: Plan
  spots: SubSpot[]
  onReorder: (p: Plan, nextIds: string[]) => void
  onRename: (p: Plan, spotId: string, title: string) => void
  edges: () => { top: number; bottom: number }
  onDragChange?: (dragging: boolean) => void
}) {
  const { parent, spots } = props
  const drag = useDragSort(
    spots.map((s) => s.id),
    { onDrop: (nextIds) => props.onReorder(parent, nextIds), edges: props.edges, onDragChange: props.onDragChange },
  )
  const byId = new Map(spots.map((s) => [s.id, s]))
  const list = drag.shown.flatMap((id) => byId.get(id) ?? [])

  const [renaming, setRenaming] = useState<{ id: string; text: string } | null>(null)
  const open = useRef<string | null>(null) // 고치는 중인 들를 곳 (Enter 뒤 blur 로 두 번 저장되지 않게)
  const start = (s: SubSpot) => {
    open.current = s.id
    setRenaming({ id: s.id, text: s.title })
  }
  const finish = (save: boolean) => {
    if (!renaming || open.current !== renaming.id) return
    open.current = null
    const s = byId.get(renaming.id)
    const t = renaming.text.trim()
    setRenaming(null)
    if (save && s && t && t !== s.title) props.onRename(parent, s.id, t)
  }

  return (
    <ul ref={drag.listRef} className="ml-3 mt-1.5 border-l-2 border-neutral-200 pl-1">
      {list.map((s, idx) => (
        // 바탕색: 끌어서 띄울 때 아래 줄 글자가 비치지 않게 (페이지 바탕과 같은 색)
        <li key={s.id} className="flex items-center rounded-lg bg-[#f4f5f8]">
          <span className="flex h-11 w-10 shrink-0 items-center justify-center" aria-hidden="true">
            <CheckCircleIcon checked={s.done} />
          </span>
          {renaming?.id === s.id ? (
            <input
              value={renaming.text}
              onChange={(e) => setRenaming({ id: s.id, text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  finish(true)
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  finish(false)
                }
              }}
              onBlur={() => finish(true)}
              autoFocus
              enterKeyHint="done"
              aria-label="들를 곳 이름"
              className="min-w-0 flex-1 rounded-lg bg-white px-2 py-1.5 text-[14px] font-semibold text-neutral-900 outline-none ring-2 ring-[#2F87F2]"
            />
          ) : (
            <button type="button" onClick={() => start(s)} aria-label={`${s.title} 이름 고치기`} className="flex min-w-0 flex-1 items-center gap-1.5 py-2 text-left">
              <span className={`truncate text-[14px] font-semibold ${s.done ? 'text-neutral-400 line-through' : 'text-neutral-800'}`}>{s.title}</span>
              <PencilIcon className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
            </button>
          )}
          <DragHandle label={`들를 곳 ${s.title} 순서 바꾸기`} {...drag.handleProps(idx)} />
        </li>
      ))}
    </ul>
  )
}

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
