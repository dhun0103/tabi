# tabi

여행(旅, たび) 일정 + 지도 + 가계부를 한 곳에서 쓰는 웹앱(PWA).
홈 화면에 추가하면 앱처럼 쓰고, 링크로 일행과 같이 쓴다.

```text
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│ 내 폰    │ ←→  │  Firestore   │ ←→  │  일행 폰     │
│ (PWA)    │     │  (Firebase)  │     │  (PWA)       │
└──────────┘     └──────────────┘     └──────────────┘
     │ 장소 검색·지도·평점          │ 길찾기 버튼
     ↓                              ↓
  Google Maps API (키 있을 때)    구글맵 앱
```

## 기능

```text
tabi
├─ 일정    탭: 전체 / DAY 1…n / 미정(가고 싶은 곳)
│          위: 지도 (날짜별 색 번호 핀 + 동선) / 아래: 번호 타임라인
│          장소 사이 거리·도보 시간, 일정 사이 메모
│          편집: 화살표로 순서 바꾸기, 거리순 동선 정리, 시간순 정리
│          장소 상세: 평점·그날 영업시간·주소·전화 (구글 장소일 때) + 구글맵/길찾기
│                     + 이 장소에서 쓴 돈 (바로 지출 추가) + 일정 수정
│                     (지도·사진은 안 넣음: 위치는 일정 화면 지도와 구글맵 버튼으로)
├─ 가계부  엔화/원화 입력 → 원화 환산, 카테고리별 합계, 일행 1/N 정산
└─ 설정    여행 정보·환율·일행, 공유 링크, JSON 백업/복원
헤더: 여행 이름 + D-day (여행 중엔 "여행 N일째")
```

### 지도·장소 검색: 구글 키 유무에 따라 자동 선택

| | 구글 키 있음 (`VITE_GOOGLE_MAPS_API_KEY`) | 키 없음 / 키 오류 |
|---|---|---|
| 지도 | 구글 지도, 한국어 지명 | 일본 국토지리원 연한 지도 (일본만) |
| 장소 검색 | 입력하는 동안 자동완성, 한국어 OK ("나고야성") | OpenStreetMap, 검색 버튼, 일본어·영어가 잘 됨 |
| 장소 상세 | 평점·영업시간·전화·웹사이트 (사진은 요금 때문에 안 불러옴) | 기본 정보만 |

- 키가 틀렸거나 API가 꺼져 있으면 구글이 알려줘서(`gm_authFailure`) 무료 지도로 자동 전환
- 거리·도보 시간은 직선거리 × 1.3 ÷ 분속 80m 로 계산한 **대략값**
- 거리순 동선 정리: 첫 장소는 고정, 나머지를 가까운 순서(최근접 + 2-opt)로. 메모는 바로 앞 장소에 붙어서 같이 이동

### 저장·공유

- `.env.local`에 Firebase 설정이 있으면 **실시간 공유**, 없으면 **이 기기에만 저장**
- 오프라인: 앱 화면은 서비스워커가, 데이터는 Firestore 캐시가 들고 있어서 끊겨도 보고 입력 가능 → 연결되면 자동 동기화
- 공유 방식: 로그인 없음. 공유 링크 안의 20자 랜덤 ID를 아는 사람만 접근 (`firestore.rules`)

## 로컬 실행

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # 타입 검사 + 빌드 (dist/)
npm run icons        # public/logo.svg 로 아이콘 다시 만들기
```

폰에서 바로 보려면 `npm run dev -- --host` 후 같은 와이파이에서 `http://<PC IP>:5173` (http라 오프라인 기능은 배포 후에만 동작)

## Firebase 연결 (일행 공유용)

1. https://console.firebase.google.com → 프로젝트 만들기 (Google 애널리틱스는 꺼도 됨)
2. 빌드 → Firestore Database → 데이터베이스 만들기 → 위치 `asia-northeast1 (Tokyo)` → 프로덕션 모드
3. Firestore → 규칙 탭 → `firestore.rules` 내용 붙여넣기 → 게시
4. 프로젝트 개요 → 웹 앱 추가(`</>`) → 나오는 `firebaseConfig` 값을 `.env.example` 참고해서 `.env.local`에 입력

## 구글 지도·장소 API 연결

```text
Google Cloud 콘솔 (Firebase와 같은 프로젝트 사용 가능)
→ 결제 계정 연결 (카드 등록 필요, 아래 무료 한도 안이면 0원)
→ API 사용 설정: Maps JavaScript API, Places API (New)
→ 사용자 인증 정보 → API 키 만들기
   · 애플리케이션 제한: 웹사이트 → http://localhost:5173/*, https://<배포주소>/*
   · API 제한: Maps JavaScript API, Places API (New) 두 개만
→ (권장) 지도 관리 → 지도 ID 만들기 (JavaScript) → VITE_GOOGLE_MAP_ID
→ (권장) 할당량에서 하루 요청 수 상한 걸기 → 무료 한도 넘는 요금 방지
→ .env.local 에 VITE_GOOGLE_MAPS_API_KEY 입력
```

요금: SKU마다 매달 무료 한도 (Essentials 10,000건 · Pro 5,000건 · Enterprise 1,000건).
지도 로드·자동완성은 Essentials, 장소 상세(평점·영업시간·전화)는 Enterprise 쪽이라 개인 여행용이면 보통 한도 안.
장소 상세는 장소 하나당 한 번만 요청하고 앱이 켜져 있는 동안 다시 쓴다.
장소 사진은 한 장 보여줄 때마다 따로 요금이 매겨지는 항목(Enterprise, 월 1,000건 무료)이라 일부러 안 불러온다.

## 배포 (Firebase 호스팅, 무료 Spark 플랜)

주소: **https://tabi-f5564.web.app**

```bash
npm.cmd run deploy        # 빌드 + 호스팅 배포 (.env.local 값이 빌드에 들어감)
npm.cmd run deploy:rules  # firestore.rules 만 다시 게시
```

- 이 PC는 PowerShell 실행 정책 때문에 `npm`/`npx` 대신 `npm.cmd`/`npx.cmd` 로 실행
- 처음 한 번 `npx.cmd -y firebase-tools@latest login` 필요 (tabi 프로젝트를 만든 개인 Gmail)
- 구글 지도 키를 만들면 웹사이트 제한에 `https://tabi-f5564.web.app/*`, `https://tabi-f5564.firebaseapp.com/*` 추가

## 폰에 설치

- 아이폰: 사파리로 열기 → 공유 버튼 → 홈 화면에 추가 → **홈 화면 아이콘으로 열어서 시작** (사파리와 저장공간이 따로)
- 안드로이드: 크롬으로 열기 → ⋮ → 홈 화면에 추가 (또는 앱 설치)
- 일행: 설정 → 링크 공유하기 → 받은 링크로 열기 (홈 화면 앱에서 처음 열 땐 "공유 링크로 참여"에 붙여넣기)

## 구조

```text
src/
├─ App.tsx                    화면 전환(시작/일정/가계부/설정), 헤더(D-day), 탭바
├─ components/
│  ├─ plans/
│  │  ├─ PlansTab.tsx         일정 탭: 전체/DAY/미정, 지도, 편집(순서·동선·시간순)
│  │  ├─ Timeline.tsx         번호 원 + 세로선 목록, 메모, 거리·도보 시간
│  │  ├─ PlaceSheet.tsx       장소 추가·수정 (구글 자동완성 / 무료 검색 / 지도에서 찍기)
│  │  ├─ DetailSheet.tsx      장소 상세 (평점·영업시간·쓴 돈·일정 수정)
│  │  └─ MemoSheet.tsx        메모 추가·수정
│  ├─ map/
│  │  ├─ MapView.tsx          구글 지도 ↔ 무료 지도 자동 선택
│  │  ├─ GoogleMap.tsx        구글 지도 (AdvancedMarker 번호 핀, 점선 동선)
│  │  ├─ LeafletMap.tsx       무료 지도 (국토지리원 타일)
│  │  └─ mapTypes.ts          공통 props
│  ├─ Onboarding.tsx          새 여행 / 링크로 참여 / 최근 여행
│  ├─ ExpensesTab.tsx         가계부 + 입력 창 + 정산
│  ├─ SettingsTab.tsx         설정, 공유, 백업
│  └─ ui.tsx                  공용 UI (Sheet, Chip, Fab …)
├─ store/                     저장소: 이 기기(localStorage) ↔ Firestore 자동 선택
├─ hooks/useTripData.ts       여행·일정·지출 실시간 구독
└─ lib/
   ├─ google.ts               구글 API 로딩·자동완성·장소 상세 (실패 시 자동 전환)
   ├─ geo.ts                  날짜별 색, 거리·도보 시간, 무료 장소 검색, 구글맵 링크
   ├─ order.ts                순서 바꾸기, 거리순 동선 정리, 시간순 정리
   ├─ util.ts                 날짜·D-day·돈·정산·공유 링크
   └─ backup.ts               저장 데이터/백업 파일 형식 맞추기
```
