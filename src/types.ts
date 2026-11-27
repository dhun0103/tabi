export type Currency = 'JPY' | 'KRW'
export type Category = 'food' | 'transport' | 'shopping' | 'lodging' | 'sights' | 'etc'
export type PayMethod = 'cash' | 'card'
export type PlanType = 'place' | 'memo' | 'flight'

/** 항공편 (일정에 비행기 아이콘으로 나옴). 출발 시간은 Plan.time */
export interface Flight {
  from: string // 출발 공항 (ICN)
  to: string // 도착 공항 (NGO)
  arrive: string // 도착 시간 HH:mm, '' = 모름
  airline: string // 제주항공
  number: string // 편명 7C1201
}

export interface Trip {
  id: string
  name: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  krwPer100Jpy: number // 기본 환율 100엔 = ?원 (환율을 못 불러올 때, 환율이 저장 안 된 예전 지출에 사용)
  members: string[] // 일행 이름 (가계부 1인당 금액 = 합계 ÷ 일행 수)
  createdAt: number
  updatedAt: number
}

export interface Plan {
  id: string
  type: PlanType // place = 장소, memo = 일정 사이 메모, flight = 항공편
  date: string // YYYY-MM-DD, '' = 날짜 미정
  time: string // HH:mm, '' = 시간 미정
  order: number // 같은 날 안의 순서 (작을수록 위)
  title: string // 장소 이름 (memo면 메모 내용)
  place: string // 구글맵 검색어
  placeId: string // 구글 장소 ID (있으면 평점·영업시간을 불러오고 구글맵이 정확히 그 장소로 열림)
  mapUrl: string // 구글맵 공유 링크 (예전 데이터 호환용)
  memo: string
  done: boolean
  lat: number | null // 지도 핀 위치 (없으면 지도에 안 나옴)
  lng: number | null
  kind: string // 관광명소, 음식점, 카페 …
  area: string // 나카구, 나고야시
  flight?: Flight // type이 flight일 때만 (다른 종류엔 이 칸 자체가 없음: Firestore는 undefined 값을 못 받음)
  spots?: SubSpot[] // 장소 안에서 들를 곳 (type이 place이고 들를 곳이 있을 때만)
  createdAt: number
  updatedAt: number
}

/**
 * 장소 안에서 들를 곳 (오스 상점가 안의 가게들)
 *   일정 흐름(번호·동선·거리)엔 안 나오고, 장소 카드의 "들를 곳 N"을 누르면 그 자리에서 펼쳐짐
 *   시간·지출·사진은 따로 없음 (큰 장소에 붙임)
 */
export interface SubSpot {
  id: string
  title: string
  place: string // 구글맵 검색어 (현지어 이름)
  placeId: string
  lat: number | null
  lng: number | null
  kind: string
  memo: string // 일정에서 가져온 장소에 있던 메모 (없으면 '')
  done: boolean // 다녀옴
}

export interface Expense {
  id: string
  date: string // YYYY-MM-DD
  title: string
  amount: number
  currency: Currency
  krwPer100Jpy: number // 이 지출에 쓴 환율 100엔 = ?원 (적을 때의 환율로 고정). 0 = 원화 지출이거나 예전 데이터 → 여행 기본 환율
  rateDate: string // 그 환율의 기준일 YYYY-MM-DD ('' = 직접 넣은 환율)
  category: Category
  method: PayMethod
  // 아래 둘은 입력 칸을 없앴음 (새 지출은 일행 첫 사람 · true로 저장, 예전 값은 그대로 둠)
  payer: string
  shared: boolean // true = 일행이 1/N, false = 개인 지출
  memo: string
  planId: string // 일정의 어느 장소에서 쓴 돈인지 ('' = 연결 안 함)
  createdAt: number
  updatedAt: number
}

/** 장소에 붙이는 사진 (폰에서 줄여서 데이터 그대로 저장: 사진 전용 저장소 없이 무료 요금제 안에서) */
export interface Photo {
  id: string
  planId: string // 어느 장소의 사진인지
  data: string // 줄인 JPEG (data URL, 1MB 문서 한도 안쪽)
  width: number
  height: number
  createdAt: number
}

export type ListName = 'plans' | 'expenses'
export type ListItem<N extends ListName> = N extends 'plans' ? Plan : Expense
