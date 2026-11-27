import type { ReactNode } from 'react'

/** 장소 종류별 아이콘 (사진이 없을 때 썸네일 자리에 쓰는 선 아이콘) */
type Kind = 'food' | 'cafe' | 'shopping' | 'lodging' | 'transport' | 'sights' | 'place'

export function kindIcon(kind: string): Kind {
  if (/카페|커피|디저트|베이커리|빵/.test(kind)) return 'cafe'
  if (/음식|식당|레스토랑|맛집|라멘|라면|스시|초밥|우동|소바|돈카츠|이자카야|술집|바$|펍/.test(kind)) return 'food'
  if (/쇼핑|백화점|마트|상점|매장|편의점|시장|몰|아웃렛|기념품/.test(kind)) return 'shopping'
  if (/호텔|숙소|료칸|게스트|호스텔|리조트|민박/.test(kind)) return 'lodging'
  if (/역|공항|터미널|정류장|교통|버스|지하철|항구/.test(kind)) return 'transport'
  if (/관광|명소|박물관|미술관|공원|성$|사원|절|신사|테마파크|동물원|수족관|전망|온천|유적/.test(kind)) return 'sights'
  return 'place'
}

const PATHS: Record<Kind, ReactNode> = {
  food: (
    <>
      <path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v8a2 2 0 0 1-2 2M9 3v6" />
      <path d="M17 21V3c-1.7 0-3 2.2-3 5v5h3" />
    </>
  ),
  cafe: (
    <>
      <path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9z" />
      <path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M12 3v3" />
    </>
  ),
  shopping: (
    <>
      <path d="M5 8h14l-1 12H6L5 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  lodging: (
    <>
      <path d="M3 19V6M21 19v-6a3 3 0 0 0-3-3h-8v6M3 16h18" />
      <circle cx="6.5" cy="11.5" r="1.8" />
    </>
  ),
  transport: (
    <>
      <rect x="6" y="3" width="12" height="13" rx="3" />
      <path d="M6 10h12M9 20l-2 1M15 20l2 1M9 13h.01M15 13h.01" />
    </>
  ),
  sights: (
    <>
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4V8z" />
      <circle cx="12" cy="13" r="3.2" />
    </>
  ),
  place: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
}

/** 가계부 카테고리 아이콘 */
const CATEGORY_KIND: Record<string, Kind> = {
  food: 'food',
  transport: 'transport',
  shopping: 'shopping',
  lodging: 'lodging',
  sights: 'sights',
}

export function CategoryIcon({ category, className = 'h-5 w-5' }: { category: string; className?: string }) {
  const kind = CATEGORY_KIND[category]
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind ? (
        PATHS[kind]
      ) : (
        // 기타: 영수증
        <>
          <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
          <path d="M9 8h6M9 12h6" />
        </>
      )}
    </svg>
  )
}

export function KindIcon({ kind, className = 'h-5 w-5' }: { kind: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[kindIcon(kind)]}
    </svg>
  )
}

/** 메모 표시 (줄 세 개, NOL·트리플 일정의 장소 메모처럼) — 장소 카드 창과 타임라인에서 같이 씀 */
export function MemoIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
      <path d="M5 7h14M5 12h14M5 17h9" />
    </svg>
  )
}

/** 들를 곳 다녀옴 체크: 안 갔으면 빈 동그라미, 다녀왔으면 파란 동그라미 + 흰 체크 */
export function CheckCircleIcon({ checked, className = 'h-5 w-5' }: { checked: boolean; className?: string }) {
  return checked ? (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="#2F87F2" />
      <path d="M7.8 12.3l2.8 2.8 5.6-5.8" fill="none" stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="#B4B8BF" strokeWidth={1.8} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

/**
 * 들를 곳 번호 동그라미 ①②③ (지도의 "7-1"과 같은 순서). 다녀왔으면 번호 대신 파란 체크
 * 누르면 다녀옴 체크 (지금처럼) — 동그라미 자리는 그대로라 줄 모양이 안 바뀜
 */
export function SpotBullet({ n, done, className = 'h-5 w-5' }: { n: number; done: boolean; className?: string }) {
  if (done) return <CheckCircleIcon checked className={className} />
  return (
    <span
      className={`${className} flex shrink-0 items-center justify-center rounded-full border-[1.8px] border-[#B4B8BF] text-[11px] font-bold leading-none text-neutral-500`}
      aria-hidden="true"
    >
      {n}
    </span>
  )
}

/** 들를 곳 (장소 카드의 줄 아이콘): 지도 핀 */
export function PinIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  )
}

/** 구글맵에서 열기 (바깥으로 나가는 화살표) */
export function ExternalIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 5h5v5M19 5l-8 8M18 14v4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18V7.5A1.5 1.5 0 0 1 5.5 6H10" />
    </svg>
  )
}

/** 이름 고치기 (작은 연필) */
export function PencilIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
      <path d="M13.5 8.5l3 3" />
    </svg>
  )
}

/** 빼기 (작은 X) */
export function XIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <path d="M7 7l10 10M17 7L7 17" />
    </svg>
  )
}

/** 항공편 (일정 타임라인의 파란 원 안 비행기). Material Icons "flight" 모양 */
export function PlaneIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
    </svg>
  )
}
