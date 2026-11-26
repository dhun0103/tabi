import { newId } from './util'

/** 이 기기에서 "지금 보고 있는 여행"과 "최근 연 여행" 기억 (localStorage) */

const CURRENT = 'tn:current'
const RECENT = 'tn:recent'
const ME = 'tn:me'

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

/**
 * 이 폰의 열쇠: 내 지출(이 폰에만 보이는 개인 지출)을 서버에 둘 자리 이름
 *   처음 쓸 때 20자 랜덤으로 만들어 이 폰에만 기억 → 일행 폰은 이 열쇠를 몰라서 내 지출을 못 읽음
 *   폰을 초기화하면 열쇠도 없어지므로 내 지출은 설정의 JSON 백업에 같이 담음
 */
let meCache: string | null = null
export function myKey(): string {
  if (meCache) return meCache
  let k = get(ME)
  if (!k || !/^[0-9A-Za-z]{20,64}$/.test(k)) {
    k = newId()
    set(ME, k)
  }
  meCache = k
  return k
}
