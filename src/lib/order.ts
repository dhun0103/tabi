import type { Plan } from '../types'
import { distanceM, hasCoords } from './geo'

/** 같은 날 안의 순서: order 작은 것부터 */
export const byOrder = (a: Plan, b: Plan) => a.order - b.order || a.createdAt - b.createdAt

/** 새로 넣는(또는 날짜·시간을 바꾼) 항목의 자리: 시간이 있으면 시간 순 자리(장소·항공편 시간 기준), 없으면 맨 끝 */
export function orderForInsert(dayItems: Plan[], time: string): number {
  const list = [...dayItems].sort(byOrder)
  if (!list.length) return 0
  if (time) {
    const idx = list.findIndex((p) => p.type !== 'memo' && p.time && p.time > time)
    if (idx === 0) return list[0].order - 1
    if (idx > 0) return (list[idx - 1].order + list[idx].order) / 2
  }
  return list[list.length - 1].order + 1
}

/** 한 칸 위/아래로 */
export function moveItem(list: Plan[], index: number, delta: -1 | 1): Plan[] {
  const j = index + delta
  if (j < 0 || j >= list.length) return list
  const next = [...list]
  ;[next[index], next[j]] = [next[j], next[index]]
  return next
}

/** 새 순서대로 order 를 0,1,2… 로 매기고, 바뀐 항목만 돌려준다 (저장할 것만) */
export function reindex(list: Plan[]): Plan[] {
  const now = Date.now()
  return list.flatMap((p, i) => (p.order === i ? [] : [{ ...p, order: i, updatedAt: now }]))
}

/*
 * 묶음 = 머리 항목 1개 + 뒤따르는 항목들 (같이 움직임)
 *   거리순 동선 정리: 머리는 장소만 → 메모·항공편은 바로 앞 장소에 붙어서 같이 이동 (항공편은 좌표가 없어서)
 *   시간순 정리: 머리는 장소·항공편 → 항공편도 자기 출발 시간으로 자리를 찾음, 메모만 앞 항목에 붙음
 */
interface Block {
  head: Plan | null
  items: Plan[]
}

const isPlace = (p: Plan) => p.type === 'place'
const isTimed = (p: Plan) => p.type !== 'memo'

function toBlocks(list: Plan[], isHead: (p: Plan) => boolean): Block[] {
  const blocks: Block[] = []
  for (const p of list) {
    if (isHead(p) || !blocks.length) blocks.push({ head: isHead(p) ? p : null, items: [p] })
    else blocks[blocks.length - 1].items.push(p)
  }
  return blocks
}

/**
 * 거리순 동선 정리: 첫 장소는 그대로 두고, 나머지를 가까운 순서로 다시 배열
 * (가장 가까운 곳부터 고른 뒤 2-opt 로 꼬인 구간을 풀어 총 이동거리를 줄인다)
 * 좌표 없는 장소는 맨 뒤로. 장소가 3곳 미만이면 바꿀 게 없어서 그대로.
 */
export function optimizeRoute(list: Plan[]): Plan[] {
  const blocks = toBlocks(list, isPlace)
  const lead = blocks.length && !blocks[0].head ? [blocks.shift()!] : []
  const geo = blocks.filter((b) => b.head && hasCoords(b.head))
  const rest = blocks.filter((b) => !(b.head && hasCoords(b.head)))
  if (geo.length < 3) return list

  const pts = geo.map((b) => b.head as Plan & { lat: number; lng: number })
  const n = pts.length
  const d = (i: number, j: number) => distanceM(pts[i], pts[j])

  let path = [0]
  const used = new Set([0])
  while (path.length < n) {
    const last = path[path.length - 1]
    let best = -1
    let bestD = Infinity
    for (let j = 0; j < n; j++) {
      if (!used.has(j) && d(last, j) < bestD) {
        bestD = d(last, j)
        best = j
      }
    }
    path.push(best)
    used.add(best)
  }

  const length = (p: number[]) => p.slice(1).reduce((s, v, i) => s + d(p[i], v), 0)
  let improved = true
  while (improved) {
    improved = false
    for (let i = 1; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        const next = [...path.slice(0, i), ...path.slice(i, k + 1).reverse(), ...path.slice(k + 1)]
        if (length(next) + 1e-6 < length(path)) {
          path = next
          improved = true
        }
      }
    }
  }
  return [...lead, ...path.map((i) => geo[i]), ...rest].flatMap((b) => b.items)
}

/** 시간순 정리: 시간 있는 장소·항공편을 시간 순으로, 시간 없는 장소는 뒤에 (원래 순서 유지) */
export function sortByTime(list: Plan[]): Plan[] {
  const blocks = toBlocks(list, isTimed)
  const lead = blocks.length && !blocks[0].head ? [blocks.shift()!] : []
  const keyed = blocks.map((b, i) => ({ b, i, t: b.head?.time ?? '' }))
  keyed.sort((x, y) => {
    if (x.t && y.t) return x.t.localeCompare(y.t) || x.i - y.i
    if (x.t) return -1
    if (y.t) return 1
    return x.i - y.i
  })
  return [...lead, ...keyed.map((k) => k.b)].flatMap((b) => b.items)
}
