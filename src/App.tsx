import { useEffect, useState, type ReactNode } from 'react'
import { ExpensesTab } from './components/ExpensesTab'
import { Onboarding } from './components/Onboarding'
import { PlansTab } from './components/plans/PlansTab'
import { SettingsTab } from './components/SettingsTab'
import { useToday } from './hooks/useToday'
import { useOnline, useTripData } from './hooks/useTripData'
import { forgetTrip, loadCurrent, rememberTrip, saveCurrent } from './lib/session'
import { ddayLabel, fmtDay, parseTripId } from './lib/util'
import { repo } from './store'
import type { Trip } from './types'

type Tab = 'plans' | 'expenses' | 'settings'

export default function App() {
  // 공유 링크(#t=...)로 들어오면 그 여행, 아니면 마지막에 보던 여행
  const [tripId, setTripId] = useState<string | null>(() => parseTripId(location.hash) ?? loadCurrent())
  const [tab, setTab] = useState<Tab>('plans')
  const { trip, plans, expenses, error } = useTripData(tripId)
  const online = useOnline()

  // 주소창에도 여행 ID를 남겨 둔다 → 그 상태로 "홈 화면에 추가"해도 같은 여행이 열림
  useEffect(() => {
    saveCurrent(tripId)
    history.replaceState(null, '', tripId ? `#t=${tripId}` : location.pathname)
  }, [tripId])

  useEffect(() => {
    const onHash = () => {
      const id = parseTripId(location.hash)
      if (id) setTripId(id)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (trip) rememberTrip({ id: trip.id, name: trip.name, startDate: trip.startDate, endDate: trip.endDate })
  }, [trip])

  // 탭을 바꾸면 맨 위부터 (최신 크롬은 scrollTo가 Promise를 돌려줘서 중괄호로 감싸야 함)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab])

  const leave = () => {
    setTripId(null)
    setTab('plans')
  }

  if (!tripId) return <Onboarding onOpen={setTripId} />

  if (trip === undefined) {
    return (
      <Center>
        <p className="text-neutral-500">{error ? '여행을 불러오지 못했어요' : '불러오는 중…'}</p>
        {error && <p className="mt-2 break-all text-xs text-red-600">{error}</p>}
        {!online && <p className="mt-2 text-sm text-neutral-500">처음 여는 여행은 인터넷 연결이 필요해요</p>}
        <button type="button" onClick={leave} className="mt-6 text-sm text-neutral-500 underline">
          처음 화면으로
        </button>
      </Center>
    )
  }

  if (trip === null) {
    return (
      <Center>
        <p className="text-3xl">🧳</p>
        <p className="mt-3 font-medium">여행을 찾을 수 없어요</p>
        <p className="mt-1 text-sm text-neutral-500">링크가 맞는지 확인해 주세요</p>
        <button
          type="button"
          onClick={() => {
            forgetTrip(tripId)
            leave()
          }}
          className="mt-6 text-sm text-neutral-500 underline"
        >
          처음 화면으로
        </button>
      </Center>
    )
  }

  return (
    <div className="min-h-dvh bg-[#f4f5f8] text-neutral-900">
      <Header trip={trip} online={online} />
      <main className="mx-auto max-w-lg" style={{ paddingBottom: 'calc(140px + env(safe-area-inset-bottom))' }}>
        {tab === 'plans' && <PlansTab trip={trip} plans={plans} expenses={expenses} />}
        {tab === 'expenses' && <ExpensesTab trip={trip} expenses={expenses} plans={plans} />}
        {tab === 'settings' && <SettingsTab key={trip.id} trip={trip} plans={plans} expenses={expenses} onLeave={leave} />}
      </main>
      <TabBar tab={tab} onChange={setTab} />
    </div>
  )
}

function Center({ children }: { children: ReactNode }) {
  return <div className="flex min-h-dvh flex-col items-center justify-center bg-[#f4f5f8] px-6 text-center">{children}</div>
}

/**
 * 왼쪽: 여행 이름 + 날짜, 오른쪽: D-day (여행 중엔 "여행 N일째", 끝나면 회색 "다녀온 여행")
 * 저장 상태는 평소(공유 중)엔 숨기고, 인터넷이 끊겼을 때만 D-day 왼쪽에 "오프라인" (고친 건 폰에 두었다가 연결되면 올라감)
 */
function Header({ trip, online }: { trip: Trip; online: boolean }) {
  const today = useToday() // 자정이 지나거나 아침에 앱을 다시 열면 "여행 N일째"도 새 날짜로
  const dday = ddayLabel(trip.startDate, trip.endDate, today)
  const past = dday === '다녀온 여행'
  const dates = trip.endDate && trip.endDate !== trip.startDate ? `${fmtDay(trip.startDate)} – ${fmtDay(trip.endDate)}` : fmtDay(trip.startDate)
  const status = repo.mode === 'local' ? { dot: 'bg-neutral-300', text: '이 기기에만 저장' } : online ? null : { dot: 'bg-amber-500', text: '오프라인' }

  // 높이 56px 고정 (일정 탭의 날짜 줄이 이 아래에 붙는다)
  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200/60 bg-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between gap-3 px-4">
        <div className="min-w-0">
          <h1 className="truncate text-[18px] font-extrabold leading-tight tracking-tight">{trip.name}</h1>
          <p className="text-xs text-neutral-400">{dates}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          {status && (
            <span className="flex items-center gap-1.5 text-[11px] text-neutral-500" role="status">
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden="true" />
              {status.text}
            </span>
          )}
          {dday && (
            <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${past ? 'bg-neutral-100 text-neutral-500' : 'bg-[#2F87F2] text-white'}`}>{dday}</span>
          )}
        </div>
      </div>
    </header>
  )
}

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  {
    id: 'plans',
    label: '일정',
    icon: (
      <>
        <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
        <circle cx="12" cy="10" r="2.3" />
      </>
    ),
  },
  {
    id: 'expenses',
    label: '가계부',
    icon: (
      <>
        <rect x="3" y="6" width="18" height="13" rx="2.5" />
        <path d="M3 10h18M7 15h4" />
      </>
    ),
  },
  {
    id: 'settings',
    label: '설정',
    icon: (
      <>
        <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
        <circle cx="15" cy="6" r="2" />
        <circle cx="9" cy="12" r="2" />
        <circle cx="17" cy="18" r="2" />
      </>
    ),
  },
]

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-100 bg-white" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="mx-auto grid max-w-lg grid-cols-3">
        {TABS.map((t) => {
          const active = t.id === tab
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 pb-2 pt-2.5 text-[11px] font-medium ${active ? 'text-neutral-900' : 'text-neutral-300'}`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth={active ? 2 : 1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {t.icon}
              </svg>
              {t.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
