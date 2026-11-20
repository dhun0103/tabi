/**
 * 오늘의 엔 → 원 환율 (Frankfurter 무료 API, 유럽중앙은행 기준값)
 * - 키 없음, 브라우저에서 바로 호출 가능 (CORS 허용)
 * - 유럽 영업일마다 하루 한 번 갱신되는 시장 기준값. 환전·카드 수수료는 빠져 있다
 * - 실시간으로 계속 바꾸지 않는다: 버튼을 누르거나 새 여행을 만들 때만 불러와서 여행 환율로 고정
 *   (그래야 합계·1/N 정산 금액이 날마다 바뀌지 않음)
 */

export interface JpyRate {
  per100: number // 100엔 = ?원 (소수 첫째 자리까지)
  date: string // 기준일 YYYY-MM-DD
}

const RATE_URL = 'https://api.frankfurter.dev/v1/latest?base=JPY&symbols=KRW'

export async function fetchJpyRate(): Promise<JpyRate> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch(RATE_URL, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`환율 서버 응답 ${res.status}`)
    const data = (await res.json()) as { date?: unknown; rates?: { KRW?: unknown } }
    const krw = data.rates?.KRW
    if (typeof krw !== 'number' || !(krw > 0)) throw new Error('환율 값을 읽지 못했어요')
    return {
      per100: Math.round(krw * 1000) / 10, // 1엔 8.3043원 → 100엔 830.4원
      date: typeof data.date === 'string' ? data.date : '',
    }
  } finally {
    clearTimeout(timer)
  }
}
