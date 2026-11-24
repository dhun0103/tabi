import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'

/*
 * 끌어서 순서 바꾸기 (NOL처럼 카드 오른쪽 ≡ 손잡이를 잡고 위아래로)
 *   잡으면 그 줄이 살짝 떠서 손가락을 따라오고, 지나가는 줄들은 비켜 줌
 *   목록이 보이는 위·아래 끝(지도·Day 버튼 밑, 탭바 위) 가까이 가면 저절로 스크롤
 *   놓으면 새 순서로 바로 그림 (저장된 데이터가 돌아오기 전에도 깜빡이지 않게) → 데이터가 오면 그 순서를 따름
 *   손잡이에 초점이 있으면 키보드 ↑↓ 로 한 칸씩
 * 목록(<ol>)의 줄(<li>) 사이에 다른 줄이 없어야 함 (편집 중엔 거리 줄을 안 그림)
 */

interface Options {
  /** 새 순서(id 목록)와 옮긴 항목 */
  onDrop: (nextIds: string[], movedId: string) => void
  /** 화면에서 목록이 보이는 위·아래 경계(px, 화면 기준). 이 근처로 끌면 저절로 스크롤 */
  edges: () => { top: number; bottom: number }
  onDragChange?: (dragging: boolean) => void
}

interface Drag {
  key: string // 시작할 때 데이터 순서 (끄는 중에 데이터가 바뀌면 취소)
  ids: string[] // 시작할 때 보이던 순서
  from: number
  to: number
  pointerId: number
  startY: number
  startScroll: number
  y: number
  rows: HTMLElement[]
  tops: number[] // 시작할 때 각 줄 위치 (문서 기준)
  heights: number[]
  frame: number
  off: () => void
}

const EDGE = 64 // 경계에서 이만큼 안쪽부터 자동 스크롤
const MAX_SPEED = 16 // 자동 스크롤: 한 프레임에 최대 px
const LIFT = '15' // 끄는 줄: 다른 줄·번호 원(z-10) 위, 지도·Day 버튼(z-20) 아래

export function moveTo<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  next.splice(to, 0, ...next.splice(from, 1))
  return next
}

function lift(el: HTMLElement) {
  el.style.position = 'relative'
  el.style.zIndex = LIFT
  el.style.filter = 'drop-shadow(0 8px 14px rgba(16, 24, 40, 0.16))'
}

function clear(rows: HTMLElement[]) {
  for (const r of rows) {
    r.style.transform = ''
    r.style.transition = ''
    r.style.position = ''
    r.style.zIndex = ''
    r.style.filter = ''
  }
}

const speed = (depth: number) => Math.ceil(Math.min(1, depth / EDGE) * MAX_SPEED)

export function useDragSort(ids: string[], options: Options) {
  const opts = useRef(options)
  useLayoutEffect(() => {
    opts.current = options
  })
  const listRef = useRef<HTMLOListElement>(null)
  const drag = useRef<Drag | null>(null)
  const settle = useRef<{ el: HTMLElement; top: number } | null>(null)
  const timer = useRef(0)

  // 놓은 순서: 저장된 데이터가 돌아올 때까지(데이터 순서가 그대로인 동안) 먼저 보여 줌
  const key = ids.join(',')
  const [dropped, setDropped] = useState<{ key: string; ids: string[] } | null>(null)
  const shown = dropped && dropped.key === key ? dropped.ids : ids
  useEffect(() => {
    if (!dropped) return
    // 저장이 실패해서 데이터가 끝내 안 바뀌면 원래 순서로
    const t = window.setTimeout(() => setDropped(null), 3000)
    return () => window.clearTimeout(t)
  }, [dropped])

  const rowsNow = () => Array.from(listRef.current?.children ?? []) as HTMLElement[]

  // 새 순서로 다시 그린 직후(화면에 그리기 전): 비켜 준 흔적을 지우고, 놓은 줄은 놓은 자리에서 제자리로 미끄러지게
  useLayoutEffect(() => {
    const s = settle.current
    if (!s) return
    settle.current = null
    clear(rowsNow())
    if (!s.el.isConnected) return
    const dy = s.top - s.el.getBoundingClientRect().top
    if (Math.abs(dy) < 1) return
    lift(s.el)
    s.el.style.transform = `translateY(${dy}px)`
    void s.el.offsetHeight // 지금 위치를 먼저 확정해야 아래 transition 이 먹음
    s.el.style.transition = 'transform 160ms ease-out'
    s.el.style.transform = ''
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => clear([s.el]), 200)
  })

  // 끄는 중에 일행이 고쳐서 목록이 바뀌면 끌기 취소 (줄 위치를 다시 재야 해서)
  useLayoutEffect(() => {
    const s = drag.current
    if (s && s.key !== key) finish(s, true)
  }, [key])

  // 화면을 떠나면 정리
  useEffect(
    () => () => {
      const s = drag.current
      if (s) finish(s, true)
      window.clearTimeout(timer.current)
    },
    [],
  )

  /** 손가락 위치에 맞춰 끄는 줄을 옮기고, 들어갈 자리까지의 줄들을 비켜 줌 */
  function place(s: Drag) {
    const dy = s.y - s.startY + (window.scrollY - s.startScroll)
    const h = s.heights[s.from]
    const mid = s.tops[s.from] + h / 2 + dy
    let to = s.from
    for (let i = s.from + 1; i < s.rows.length; i++) if (mid > s.tops[i] + s.heights[i] / 2) to = i
    for (let i = s.from - 1; i >= 0; i--) if (mid < s.tops[i] + s.heights[i] / 2) to = i
    s.to = to
    s.rows.forEach((r, i) => {
      if (i === s.from) {
        r.style.transform = `translateY(${dy}px) scale(1.02)`
        return
      }
      const shift = s.from < to && i > s.from && i <= to ? -h : to < s.from && i >= to && i < s.from ? h : 0
      r.style.transform = shift ? `translateY(${shift}px)` : ''
    })
  }

  /** 끄는 동안 매 프레임: 위·아래 끝 가까이면 저절로 스크롤 */
  function tick(s: Drag) {
    if (drag.current !== s) return
    if (!s.rows[s.from].isConnected) return finish(s, true)
    const { top, bottom } = opts.current.edges()
    const v = s.y < top + EDGE ? -speed(top + EDGE - s.y) : s.y > bottom - EDGE ? speed(s.y - (bottom - EDGE)) : 0
    if (v) {
      const before = window.scrollY
      window.scrollBy(0, v)
      if (window.scrollY !== before) place(s)
    }
    s.frame = requestAnimationFrame(() => tick(s))
  }

  function start(e: ReactPointerEvent<HTMLElement>, index: number) {
    if (drag.current || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return
    const rows = rowsNow()
    if (!rows[index] || rows.length !== shown.length) return
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* 이미 뗀 손가락 */
    }
    window.clearTimeout(timer.current)
    clear(rows) // 직전에 놓은 줄이 아직 미끄러지는 중이면 정리 (위치를 재기 전에)
    const scroll = window.scrollY
    const rects = rows.map((r) => r.getBoundingClientRect())
    const s: Drag = {
      key,
      ids: shown,
      from: index,
      to: index,
      pointerId: e.pointerId,
      startY: e.clientY,
      startScroll: scroll,
      y: e.clientY,
      rows,
      tops: rects.map((r) => r.top + scroll),
      heights: rects.map((r) => r.height),
      frame: 0,
      off: () => {},
    }
    // 창 전체에서 받음: 손가락이 손잡이 밖으로 나가도 계속 따라가게
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== s.pointerId) return
      s.y = ev.clientY
      place(s)
    }
    const onUp = (ev: PointerEvent) => ev.pointerId === s.pointerId && finish(s, false)
    const onCancel = (ev: PointerEvent) => ev.pointerId === s.pointerId && finish(s, true)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    s.off = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
    drag.current = s
    rows.forEach((r, i) => {
      r.style.transition = i === index ? 'none' : 'transform 150ms ease'
    })
    lift(rows[index])
    place(s)
    opts.current.onDragChange?.(true)
    try {
      // 잡았다는 느낌 (안드로이드만). 화면을 한 번도 안 눌렀으면 브라우저가 막고 오류를 남겨서 그땐 생략
      if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(10)
    } catch {
      /* 진동이 없는 폰 */
    }
    s.frame = requestAnimationFrame(() => tick(s))
  }

  function finish(s: Drag, cancelled: boolean) {
    if (drag.current !== s) return
    drag.current = null
    s.off()
    cancelAnimationFrame(s.frame)
    opts.current.onDragChange?.(false)
    const el = s.rows[s.from]
    if (!cancelled && s.to !== s.from && el.isConnected) {
      const next = moveTo(s.ids, s.from, s.to)
      settle.current = { el, top: el.getBoundingClientRect().top }
      setDropped({ key: s.key, ids: next })
      opts.current.onDrop(next, s.ids[s.from])
      return
    }
    // 제자리로 (같은 자리에 놓았거나 취소)
    for (const r of s.rows) {
      r.style.transition = 'transform 160ms ease-out'
      r.style.transform = ''
    }
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => clear(s.rows), 200)
  }

  function onKey(e: KeyboardEvent<HTMLElement>, index: number) {
    const to = e.key === 'ArrowUp' ? index - 1 : e.key === 'ArrowDown' ? index + 1 : -1
    if (to < 0 || to >= shown.length || drag.current) return
    e.preventDefault()
    const next = moveTo(shown, index, to)
    setDropped({ key, ids: next })
    opts.current.onDrop(next, shown[index])
  }

  return {
    listRef,
    /** 지금 보여 줄 순서 (id) */
    shown,
    /** ≡ 손잡이에 붙일 것 */
    handleProps: (index: number) => ({
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => start(e, index),
      onKeyDown: (e: KeyboardEvent<HTMLElement>) => onKey(e, index),
    }),
  }
}
