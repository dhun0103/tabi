import type { Expense, Flight, Plan, PlanType, Trip } from '../types'
import { CATEGORIES } from './util'

/**
 * 저장소·백업 파일에서 읽은 데이터를 앱이 쓰는 모양으로 맞춘다.
 * (예전 버전에서 만든 데이터에 새 필드가 없어도 기본값으로 채움)
 */

export interface Backup {
  app: 'tabi'
  version: 1
  exportedAt: string
  trip: Trip
  plans: Plan[]
  expenses: Expense[]
  mine?: Expense[] // 이 폰의 내 지출 (폰을 바꾸거나 초기화해도 되살릴 수 있게). 예전 백업엔 없음
}

type Obj = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const coord = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const okId = (v: unknown): v is string => typeof v === 'string' && /^[0-9A-Za-z_-]{1,64}$/.test(v)

function normalizeFlight(x: unknown): Flight {
  const f = (x ?? {}) as Obj
  return { from: str(f.from), to: str(f.to), arrive: str(f.arrive), airline: str(f.airline), number: str(f.number) }
}

export function normalizePlan(x: unknown): Plan | null {
  const o = (x ?? {}) as Obj
  if (!okId(o.id)) return null
  const now = Date.now()
  const lat = coord(o.lat)
  const lng = coord(o.lng)
  const createdAt = num(o.createdAt, now)
  const type: PlanType = o.type === 'memo' || o.type === 'flight' ? o.type : 'place'
  return {
    id: o.id,
    type,
    // 항공편만 flight 칸을 가짐 (다른 종류엔 칸을 아예 안 만듦: Firestore가 undefined를 못 받음)
    ...(type === 'flight' ? { flight: normalizeFlight(o.flight) } : {}),
    date: str(o.date),
    time: str(o.time),
    order: num(o.order, createdAt), // 예전 데이터: 만든 순서대로
    title: str(o.title) || '(제목 없음)',
    place: str(o.place),
    placeId: str(o.placeId),
    mapUrl: str(o.mapUrl),
    memo: str(o.memo),
    done: o.done === true,
    lat: lat !== null && lng !== null ? lat : null,
    lng: lat !== null && lng !== null ? lng : null,
    kind: str(o.kind),
    area: str(o.area),
    createdAt,
    updatedAt: num(o.updatedAt, now),
  }
}

export function normalizeExpense(x: unknown): Expense | null {
  const o = (x ?? {}) as Obj
  const amount = num(o.amount, 0)
  if (!okId(o.id) || !(amount > 0)) return null
  const now = Date.now()
  const category = CATEGORIES.find((c) => c.id === o.category)?.id ?? 'etc'
  const currency = o.currency === 'KRW' ? 'KRW' : 'JPY'
  const rate = currency === 'JPY' ? num(o.krwPer100Jpy, 0) : 0
  return {
    id: o.id,
    date: str(o.date),
    title: str(o.title),
    amount,
    currency,
    // 예전 데이터엔 없음 → 0 (여행 기본 환율로 계산)
    krwPer100Jpy: rate > 0 ? rate : 0,
    rateDate: rate > 0 ? str(o.rateDate) : '',
    category,
    method: o.method === 'cash' ? 'cash' : 'card',
    payer: str(o.payer),
    shared: o.shared !== false,
    memo: str(o.memo),
    planId: str(o.planId),
    createdAt: num(o.createdAt, now),
    updatedAt: num(o.updatedAt, now),
  }
}

export function parseBackup(text: string): { plans: Plan[]; expenses: Expense[]; mine: Expense[] } {
  let data: Obj
  try {
    data = JSON.parse(text) as Obj
  } catch {
    throw new Error('JSON 파일이 아니에요')
  }
  if (!data || !Array.isArray(data.plans) || !Array.isArray(data.expenses)) {
    throw new Error('tabi 백업 파일이 아니에요')
  }
  return {
    plans: data.plans.map(normalizePlan).filter((p): p is Plan => p !== null),
    expenses: data.expenses.map(normalizeExpense).filter((e): e is Expense => e !== null),
    mine: Array.isArray(data.mine) ? data.mine.map(normalizeExpense).filter((e): e is Expense => e !== null) : [],
  }
}
