export type Currency = 'JPY' | 'KRW'
export type Category = 'food' | 'transport' | 'shopping' | 'lodging' | 'sights' | 'etc'
export type PayMethod = 'cash' | 'card'
export type PlanType = 'place' | 'memo'

export interface Trip {
  id: string
  name: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  krwPer100Jpy: number // 100엔 = ?원
  members: string[] // 일행 이름 (가계부 "누가 냈나"에 사용)
  createdAt: number
  updatedAt: number
}

export interface Plan {
  id: string
  type: PlanType // place = 장소, memo = 일정 사이 메모
  date: string // YYYY-MM-DD, '' = 날짜 미정
  time: string // HH:mm, '' = 시간 미정
  order: number // 같은 날 안의 순서 (작을수록 위)
  title: string // 장소 이름 (memo면 메모 내용)
  place: string // 구글맵 검색어
  placeId: string // 구글 장소 ID (있으면 사진·평점을 불러오고 구글맵이 정확히 그 장소로 열림)
  mapUrl: string // 구글맵 공유 링크 (예전 데이터 호환용)
  memo: string
  done: boolean
  lat: number | null // 지도 핀 위치 (없으면 지도에 안 나옴)
  lng: number | null
  kind: string // 관광명소, 음식점, 카페 …
  area: string // 나카구, 나고야시
  createdAt: number
  updatedAt: number
}

export interface Expense {
  id: string
  date: string // YYYY-MM-DD
  title: string
  amount: number
  currency: Currency
  category: Category
  method: PayMethod
  payer: string
  shared: boolean // true = 일행이 1/N, false = 개인 지출
  memo: string
  planId: string // 일정의 어느 장소에서 쓴 돈인지 ('' = 연결 안 함)
  createdAt: number
  updatedAt: number
}

export type ListName = 'plans' | 'expenses'
export type ListItem<N extends ListName> = N extends 'plans' ? Plan : Expense
