import { useEffect, useMemo, useState } from 'react'
import { cachedJpyRate, fetchJpyRate } from '../lib/rate'
import { loadRecent } from '../lib/session'
import { fmtDay, newId, parseTripId } from '../lib/util'
import { repo } from '../store'
import type { Trip } from '../types'
import { MembersField, addName } from './MembersField'
import { Band, Field, btnPrimary, inputCls, reportError, sectionTitle } from './ui'

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

/**
 * 여행의 기본 환율 (만들기 화면에선 묻지 않음): 받아 둔 최신 환율 → 없으면 3초만 기다려 받아 보고 → 그래도 안 되면 대략값
 * 지출마다 그때 환율이 따로 저장되니, 이 값은 환율을 못 불러올 때만 쓰임. 설정에서 고칠 수 있음
 */
const FALLBACK_PER100 = 900
async function defaultRate(): Promise<number> {
  const cached = cachedJpyRate()
  if (cached) return cached.per100
  try {
    const r = await Promise.race([fetchJpyRate(), new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))])
    return r.per100
  } catch {
    return FALLBACK_PER100
  }
}

/** 여행이 선택되지 않았을 때: 새 여행 만들기 / 링크로 참여 / 최근 여행 */
export function Onboarding({ onOpen }: { onOpen: (id: string) => void }) {
  const recent = useMemo(loadRecent, [])
  const [name, setName] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [members, setMembers] = useState<string[]>(['나'])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState('')
  const [error, setError] = useState('')
  const [joinError, setJoinError] = useState('')

  // 화면을 여는 동안 최신 환율을 미리 받아 둠 (만들기를 누를 땐 바로 씀)
  useEffect(() => {
    fetchJpyRate().catch(() => {})
  }, [])

  const create = async () => {
    if (!name.trim()) return setError('여행 이름을 적어 주세요')
    if (!start) return setError('시작일을 골라 주세요')
    if (end && end < start) return setError('종료일이 시작일보다 빨라요')
    setBusy(true)
    const list = addName(members, draft) // [추가]를 안 누르고 적어만 둔 이름도 넣음
    const now = Date.now()
    const trip: Trip = {
      id: newId(),
      name: name.trim(),
      startDate: start,
      endDate: end || start,
      krwPer100Jpy: await defaultRate(),
      members: list.length ? list : ['나'],
      createdAt: now,
      updatedAt: now,
    }
    repo.createTrip(trip).catch(reportError)
    onOpen(trip.id)
  }

  const join = () => {
    const id = parseTripId(link)
    if (!id) return setJoinError('공유 링크를 그대로 붙여넣어 주세요')
    onOpen(id)
  }

  return (
    <div className="min-h-dvh bg-[#f4f5f8] text-neutral-900">
      <div className="mx-auto max-w-lg pb-12" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <header className="px-5 pb-6 pt-6">
          <img src="/logo.svg" alt="" className="h-11 w-11" />
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">tabi</h1>
          <p className="mt-1 text-sm text-neutral-500">일정, 지도, 가계부를 한 곳에서 · 旅(たび) = 여행</p>
        </header>

        {(isIOS() && !isStandalone()) || repo.mode === 'local' ? (
          <div className="mx-5 mb-6 space-y-2 rounded-xl bg-neutral-50 px-4 py-3.5 text-[13px] leading-relaxed text-neutral-600">
            {isIOS() && !isStandalone() && (
              <p>
                📱 아이폰은 사파리 공유 버튼 → <b>홈 화면에 추가</b>를 먼저 하고, 홈 화면 아이콘으로 열어서 시작하세요. 사파리와
                저장공간이 따로예요.
              </p>
            )}
            {repo.mode === 'local' && (
              <p>
                지금은 <b>이 기기에만 저장</b>돼요. 일행과 같이 쓰려면 Firebase 연결이 필요해요.
              </p>
            )}
          </div>
        ) : null}

        {recent.length > 0 && (
          <>
            <section className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05),0_4px_14px_rgba(16,24,40,0.06)] mx-4 px-5 pb-3 pt-4">
              <h2 className={sectionTitle}>최근 여행</h2>
              <ul className="mt-2 divide-y divide-neutral-100">
                {recent.map((t) => (
                  <li key={t.id}>
                    <button type="button" onClick={() => onOpen(t.id)} className="flex w-full items-center justify-between py-3.5 text-left active:bg-neutral-50">
                      <span className="text-[15px] font-medium">{t.name}</span>
                      <span className="text-[13px] text-neutral-400">
                        {fmtDay(t.startDate)} – {fmtDay(t.endDate)} ›
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            <Band />
          </>
        )}

        <section className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05),0_4px_14px_rgba(16,24,40,0.06)] mx-4 space-y-5 p-5">
          <h2 className={sectionTitle}>새 여행 만들기</h2>
          <Field label="여행 이름">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 나고야 여행" className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="시작일">
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
            </Field>
            <Field label="종료일">
              <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <MembersField members={members} onChange={setMembers} draft={draft} onDraft={setDraft} hint="같이 가는 사람을 한 명씩 추가하세요. 2명 이상이면 가계부에 1인당 금액이 나와요." />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="button" onClick={() => void create()} disabled={busy} className={btnPrimary}>
            {busy ? '만드는 중…' : '여행 만들기'}
          </button>
        </section>

        {repo.mode === 'cloud' && (
          <>
            <Band />
            <section className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05),0_4px_14px_rgba(16,24,40,0.06)] mx-4 space-y-3 p-5">
              <h2 className={sectionTitle}>공유 링크로 참여</h2>
              <p className="text-sm text-neutral-500">일행에게 받은 링크를 붙여넣으세요.</p>
              <input
                value={link}
                onChange={(e) => {
                  setLink(e.target.value)
                  setJoinError('')
                }}
                placeholder="https://…/#t=…"
                inputMode="url"
                aria-label="공유 링크"
                className={inputCls}
              />
              {joinError && <p className="text-sm text-red-600">{joinError}</p>}
              <button type="button" onClick={join} className={btnPrimary}>
                참여하기
              </button>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
