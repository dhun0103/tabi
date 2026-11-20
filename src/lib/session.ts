/** 이 기기에서 "지금 보고 있는 여행"과 "최근 연 여행" 기억 (localStorage) */

const CURRENT = 'tn:current'
const RECENT = 'tn:recent'

export interface RecentTrip {
  id: string
  name: string
  startDate: string
  endDate: string
}

function get(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function set(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* 저장 불가(사파리 개인정보 보호 모드 등) → 무시 */
  }
}

export const loadCurrent = () => get(CURRENT)
export const saveCurrent = (id: string | null) => set(CURRENT, id)

export function loadRecent(): RecentTrip[] {
  try {
    const list = JSON.parse(get(RECENT) ?? '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function rememberTrip(t: RecentTrip) {
  const list = [t, ...loadRecent().filter((r) => r.id !== t.id)].slice(0, 10)
  set(RECENT, JSON.stringify(list))
}

export function forgetTrip(id: string) {
  set(RECENT, JSON.stringify(loadRecent().filter((r) => r.id !== id)))
}
