import type { Category, Currency, Expense, Flight, PayMethod, Plan } from '../types'

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

/** 시트 제목 아래에 보여 줄 날: "Day 2 · 12/6(일)" / "날짜 미정 · 가고 싶은 곳" */
export function dayText(days: string[], d: string): string {
  if (days.includes(d)) return `Day ${days.indexOf(d) + 1} · ${fmtDay(d)}`
  return d ? fmtDay(d) : '날짜 미정 · 가고 싶은 곳'
}

/** 항공편 제목 (NOL 표기): "ICN 09:10 - NGO 10:55". 비어 있는 칸은 건너뜀 */
export function flightTitle(f: Pick<Flight, 'from' | 'to' | 'arrive'>, depart: string): string {
  const a = [f.from, depart].filter(Boolean).join(' ')
  const b = [f.to, f.arrive].filter(Boolean).join(' ')
  return [a, b].filter(Boolean).join(' - ')
}

/** 시간을 처음 고를 때 보여 줄 값: 그날 마지막 일정 1시간 뒤 (없으면 12:00) */
export function suggestTime(plans: Plan[], date: string, exceptId?: string): string {
  // 항공편은 도착 시간까지 보고 그 1시간 뒤를 권함
  const last = plans
    .filter((p) => p.id !== exceptId && p.date === date)
    .flatMap((p) => [p.time, p.flight?.arrive ?? ''])
    .filter(Boolean)
    .sort()
    .pop()
  if (!last) return '12:00'
  const [h, m] = last.split(':').map(Number)
  return `${String(Math.min(23, h + 1)).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`
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

/** 지출 하나를 원화로: 그 지출에 저장된 환율, 없으면(예전 데이터) 여행 기본 환율 */
export function expenseKRW(e: Pick<Expense, 'amount' | 'currency' | 'krwPer100Jpy'>, tripRate: number): number {
  return toKRW(e.amount, e.currency, e.krwPer100Jpy > 0 ? e.krwPer100Jpy : tripRate)
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

/** 일정 장소의 종류(관광명소, 음식점 …)로 지출 카테고리 추측 */
export function categoryFromKind(kind: string): Category {
  if (/음식|식당|레스토랑|맛집|라멘|라면|스시|초밥|우동|소바|돈카츠|이자카야|카페|커피|베이커리|빵|디저트|술집|바$|펍/.test(kind)) return 'food'
  if (/쇼핑|백화점|마트|상점|매장|편의점|시장|몰|아웃렛|기념품/.test(kind)) return 'shopping'
  if (/호텔|숙소|료칸|게스트|호스텔|리조트|민박/.test(kind)) return 'lodging'
  if (/역|공항|터미널|정류장|교통|버스|지하철|항구/.test(kind)) return 'transport'
  if (/관광|명소|박물관|미술관|공원|성$|사원|절|신사|테마파크|동물원|수족관|전망|온천|유적/.test(kind)) return 'sights'
  return 'etc'
}

export const METHODS: { id: PayMethod; label: string }[] = [
  { id: 'cash', label: '현금' },
  { id: 'card', label: '카드' },
]


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
