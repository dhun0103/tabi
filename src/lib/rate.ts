/**
 * 최신 엔 → 원 환율 (키 없는 무료 API 두 곳, 브라우저에서 바로 호출)
 *   1순위 ExchangeRate-API 공개 주소: 주말 포함 매일 한 번, 한국 시간 오전 9시쯤 갱신
 *   2순위 Frankfurter: 유럽중앙은행 기준값. 유럽 평일에만, 한국 시간 자정쯤 갱신
 *         (그래서 이것만 쓰면 월요일 오전엔 금요일 값이 나옴)
 * 둘 다 시장 중간값이라 환전·카드 수수료는 빠져 있다.
 * 지출을 적을 때 이 값을 그 지출에 저장해 두므로, 나중에 환율이 바뀌어도 이미 적은 금액·정산은 그대로다.
 */

export interface JpyRate {
  per100: number // 100엔 = ?원 (소수 첫째 자리까지)
  date: string // 기준일 YYYY-MM-DD (한국 날짜)
  source: 'exchangerate-api' | 'ecb'
}

interface Cached {
  rate: JpyRate
  fetchedAt: number
  nextUpdate: number // 이 시각 전엔 새 값이 없음 (모르면 0)
}

const CACHE_KEY = 'tabi.jpyRate'
const HOUR = 60 * 60 * 1000

const round1 = (krwPerYen: number) => Math.round(krwPerYen * 1000) / 10 // 1엔 8.452원 → 100엔 845.2원
const kstDate = (ms: number) => new Date(ms + 9 * HOUR).toISOString().slice(0, 10)

function readCache(): Cached | null {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as Cached | null
    return c && c.rate && c.rate.per100 > 0 ? c : null
  } catch {
    return null
  }
}

function writeCache(c: Cached) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c))
  } catch {
    /* 저장 공간이 없거나 막힘: 다음에 다시 받으면 됨 */
  }
}

/** 마지막으로 받아 둔 환율 (인터넷 없이 바로 쓸 값). 없으면 null */
export function cachedJpyRate(): JpyRate | null {
  return readCache()?.rate ?? null
}

async function getJson(url: string): Promise<unknown> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`환율 서버 응답 ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

async function fromExchangeRateApi(): Promise<Cached> {
  const d = (await getJson('https://open.er-api.com/v6/latest/JPY')) as {
    result?: string
    time_last_update_unix?: number
    time_next_update_unix?: number
    rates?: { KRW?: unknown }
  }
  const krw = d.rates?.KRW
  if (d.result !== 'success' || typeof krw !== 'number' || !(krw > 0)) throw new Error('환율 값을 읽지 못했어요')
  const updated = (d.time_last_update_unix ?? 0) * 1000 || Date.now()
  return {
    rate: { per100: round1(krw), date: kstDate(updated), source: 'exchangerate-api' },
    fetchedAt: Date.now(),
    nextUpdate: (d.time_next_update_unix ?? 0) * 1000,
  }
}

async function fromEcb(): Promise<Cached> {
  const d = (await getJson('https://api.frankfurter.dev/v1/latest?base=JPY&symbols=KRW')) as { date?: unknown; rates?: { KRW?: unknown } }
  const krw = d.rates?.KRW
  if (typeof krw !== 'number' || !(krw > 0)) throw new Error('환율 값을 읽지 못했어요')
  return {
    rate: { per100: round1(krw), date: typeof d.date === 'string' ? d.date : kstDate(Date.now()), source: 'ecb' },
    fetchedAt: Date.now(),
    nextUpdate: 0,
  }
}

/**
 * 최신 환율. 1시간 안에 받았고 다음 갱신 시각 전이면 받아 둔 값을 그대로 쓴다
 * (무료 API가 1시간에 1번 이하로 부르라고 권장). 인터넷이 안 되면 마지막으로 받은 값.
 */
export async function fetchJpyRate(): Promise<JpyRate> {
  const cached = readCache()
  const now = Date.now()
  if (cached && now - cached.fetchedAt < HOUR && (!cached.nextUpdate || now < cached.nextUpdate)) return cached.rate
  try {
    const fresh = await fromExchangeRateApi().catch(() => fromEcb())
    writeCache(fresh)
    return fresh.rate
  } catch (e) {
    if (cached) return cached.rate
    throw e
  }
}

export const RATE_SOURCE_LABEL: Record<JpyRate['source'], string> = {
  'exchangerate-api': 'Exchange Rate API',
  ecb: '유럽중앙은행',
}
