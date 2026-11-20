import type { Category, Currency, Expense, PayMethod } from '../types'

/* ───────── ID ───────── */

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

/** 20자 랜덤 ID (≈119bit). crypto.getRandomValues 는 http(사내망 IP 테스트)에서도 동작 */
export function newId(len = 20): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  let out = ''
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length]
  return out
}

/* ───────── 날짜 (YYYY-MM-DD 문자열, 시간대 영향 없게 UTC로 계산) ───────── */

const pad = (n: number) => String(n).padStart(2, '0')
const WEEK = ['일', '월', '화', '수', '목', '금', '토']

function parse(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function addDays(date: string, n: number): string {
  const d = parse(date)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** 여행 기간의 날짜 목록 (최대 60일) */
export function tripDays(start: string, end: string): string[] {
  if (!start) return []
  if (!end || end < start) return [start]
  const out: string[] = []
  for (let d = start; d <= end && out.length < 60; d = addDays(d, 1)) out.push(d)
  return out
}

/** '2026-12-05' → '12/5(토)' */
export function fmtDay(date: string): string {
  if (!date) return '날짜 미정'
  const d = parse(date)
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WEEK[d.getUTCDay()]})`
}

/** 두 날짜 사이 일수 (b - a) */
export function daysBetween(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000)
}

/** 'D-15' / '여행 2일째' / '다녀온 여행' */
export function ddayLabel(start: string, end: string): string {
  const today = todayStr()
  if (!start) return ''
  if (today < start) return `D-${daysBetween(today, start)}`
  if (today <= (end || start)) return `여행 ${daysBetween(start, today) + 1}일째`
  return '다녀온 여행'
}

/** 월요일=0 … 일요일=6 (구글 영업시간 목록 순서) */
export function mondayIndex(date: string): number {
  return (parse(date || todayStr()).getUTCDay() + 6) % 7
}

/** 여행 기간 안이면 오늘, 아니면 첫날 */
export function defaultDay(start: string, end: string): string {
  const today = todayStr()
  return start && today >= start && today <= (end || start) ? today : start || today
}

/* ───────── 돈 ───────── */

export function toKRW(amount: number, currency: Currency, krwPer100Jpy: number): number {
  return currency === 'KRW' ? amount : (amount * krwPer100Jpy) / 100
}

export const fmtKRW = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`
export const fmtJPY = (n: number) => `¥${Math.round(n).toLocaleString('ko-KR')}`
export const fmtMoney = (n: number, c: Currency) => (c === 'JPY' ? fmtJPY(n) : fmtKRW(n))

export const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: 'food', label: '식비', emoji: '🍜' },
  { id: 'transport', label: '교통', emoji: '🚃' },
  { id: 'shopping', label: '쇼핑', emoji: '🛍️' },
  { id: 'lodging', label: '숙소', emoji: '🏨' },
  { id: 'sights', label: '관광', emoji: '🎫' },
  { id: 'etc', label: '기타', emoji: '📦' },
]
export const categoryOf = (id: Category) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[5]

export const METHODS: { id: PayMethod; label: string }[] = [
  { id: 'cash', label: '현금' },
  { id: 'card', label: '카드' },
]

export interface Settlement {
  people: { name: string; paid: number; balance: number }[] // balance > 0 이면 받을 돈
  share: number // 1인당 부담액
  total: number // 공동 경비 합계
  transfers: { from: string; to: string; amount: number }[]
}

/** 공동 경비(shared)를 1/N 해서 누가 누구에게 얼마 보내면 되는지 계산 (원화 기준) */
export function settle(members: string[], expenses: Expense[], krwPer100Jpy: number): Settlement {
  const shared = expenses.filter((e) => e.shared)
  const names = [...new Set([...members, ...shared.map((e) => e.payer).filter(Boolean)])]
  const paid = new Map(names.map((n) => [n, 0]))
  let total = 0
  for (const e of shared) {
    const v = toKRW(e.amount, e.currency, krwPer100Jpy)
    total += v
    paid.set(e.payer, (paid.get(e.payer) ?? 0) + v)
  }
  const share = names.length ? total / names.length : 0
  const people = names.map((name) => ({ name, paid: paid.get(name) ?? 0, balance: (paid.get(name) ?? 0) - share }))

  const debtors = people.filter((p) => p.balance < -0.5).map((p) => ({ name: p.name, amt: -p.balance }))
  const creditors = people.filter((p) => p.balance > 0.5).map((p) => ({ name: p.name, amt: p.balance }))
  debtors.sort((a, b) => b.amt - a.amt)
  creditors.sort((a, b) => b.amt - a.amt)

  const transfers: Settlement['transfers'] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const x = Math.min(debtors[i].amt, creditors[j].amt)
    if (x >= 1) transfers.push({ from: debtors[i].name, to: creditors[j].name, amount: Math.round(x) })
    debtors[i].amt -= x
    creditors[j].amt -= x
    if (debtors[i].amt < 0.5) i++
    if (creditors[j].amt < 0.5) j++
  }
  return { people, share, total, transfers }
}

/* ───────── 공유 링크 ───────── */

export function shareLink(tripId: string): string {
  return `${location.origin}/#t=${tripId}`
}

/** 공유 링크 전체나 코드만 붙여넣어도 여행 ID를 뽑아낸다 */
export function parseTripId(input: string): string | null {
  const s = input.trim()
  const m = s.match(/[#&?]t=([0-9A-Za-z]{20,})/)
  if (m) return m[1]
  return /^[0-9A-Za-z]{20,}$/.test(s) ? s : null
}
