import { useRef, useState } from 'react'
import { parseBackup, type Backup } from '../lib/backup'
import { shareLink, todayStr } from '../lib/util'
import { repo } from '../store'
import type { Expense, Plan, Trip } from '../types'
import { Band, Field, btnPrimary, inputCls, reportError, sectionTitle } from './ui'

const isTouch = () => matchMedia('(pointer: coarse)').matches
const btnLine =
  'flex-1 rounded-xl border border-neutral-200 py-3 text-sm font-medium text-neutral-700 active:bg-neutral-50'

export function SettingsTab(props: { trip: Trip; plans: Plan[]; expenses: Expense[]; onLeave: () => void }) {
  const { trip, plans, expenses, onLeave } = props
  const [name, setName] = useState(trip.name)
  const [start, setStart] = useState(trip.startDate)
  const [end, setEnd] = useState(trip.endDate)
  const [rate, setRate] = useState(String(trip.krwPer100Jpy))
  const [members, setMembers] = useState<string[]>(trip.members)
  const [newMember, setNewMember] = useState('')
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const link = shareLink(trip.id)

  const addMember = () => {
    const n = newMember.trim()
    if (n && !members.includes(n)) setMembers([...members, n])
    setNewMember('')
  }

  const save = () => {
    const r = Number(rate)
    if (!name.trim()) return setMsg('여행 이름을 적어 주세요')
    if (!start) return setMsg('시작일을 골라 주세요')
    if (end && end < start) return setMsg('종료일이 시작일보다 빨라요')
    if (!(r > 0)) return setMsg('환율을 확인해 주세요 (100엔 = ?원)')
    const n = newMember.trim()
    const nextMembers = n && !members.includes(n) ? [...members, n] : members
    setMembers(nextMembers)
    setNewMember('')
    repo
      .updateTrip(trip.id, { name: name.trim(), startDate: start, endDate: end || start, krwPer100Jpy: r, members: nextMembers })
      .catch(reportError)
    setMsg('저장했어요')
  }

  const shareTrip = async () => {
    if (isTouch() && navigator.share) {
      try {
        await navigator.share({ title: trip.name, text: `${trip.name} — tabi에서 같이 봐요`, url: link })
      } catch {
        /* 공유 창을 닫음 */
      }
      return
    }
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      prompt('이 링크를 복사하세요', link)
    }
  }

  const exportBackup = async () => {
    const data: Backup = { app: 'tabi', version: 1, exportedAt: new Date().toISOString(), trip, plans, expenses }
    const fileName = `tabi-${trip.name}-${todayStr()}.json`.replace(/[\\/:*?"<>|]/g, '_')
    const file = new File([JSON.stringify(data, null, 2)], fileName, { type: 'application/json' })
    if (isTouch() && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: fileName })
      } catch {
        /* 취소 */
      }
      return
    }
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const importBackup = async (file: File) => {
    try {
      const { plans: ps, expenses: es } = parseBackup(await file.text())
      if (!confirm(`일정 ${ps.length}개, 지출 ${es.length}개를 이 여행에 합칠까요?\n(같은 항목은 백업 내용으로 덮어써요)`)) return
      let alerted = false
      const onErr = (e: unknown) => {
        if (!alerted) {
          alerted = true
          reportError(e)
        }
      }
      ps.forEach((p) => repo.saveItem(trip.id, 'plans', p).catch(onErr))
      es.forEach((e) => repo.saveItem(trip.id, 'expenses', e).catch(onErr))
      setMsg(`가져왔어요: 일정 ${ps.length}개, 지출 ${es.length}개`)
    } catch (e) {
      alert(`가져오지 못했어요: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return (
    <div>
      <section className="space-y-5 px-5 py-5">
        <h3 className={sectionTitle}>여행 정보</h3>
        <Field label="여행 이름">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="시작일">
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
          </Field>
          <Field label="종료일">
            <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Field label="환율 (100엔 = ?원)" hint="실제로 환전한 환율이나 카드 환율로 넣으면 원화 환산이 정확해져요">
          <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" className={inputCls} />
        </Field>
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-neutral-500">일행 (가계부 정산에 사용)</span>
          <div className="flex flex-wrap gap-1.5">
            {members.map((m) => (
              <span key={m} className="inline-flex items-center gap-1 rounded-full bg-neutral-100 py-1.5 pl-3.5 pr-1.5 text-sm">
                {m}
                <button
                  type="button"
                  onClick={() => setMembers(members.filter((x) => x !== m))}
                  aria-label={`${m} 빼기`}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-xs text-neutral-400 active:bg-neutral-200"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={newMember}
              onChange={(e) => setNewMember(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addMember()}
              placeholder="이름 추가"
              aria-label="일행 이름 추가"
              className={inputCls}
            />
            <button type="button" onClick={addMember} className="shrink-0 rounded-xl border border-neutral-200 px-4 text-sm font-medium text-neutral-700">
              추가
            </button>
          </div>
        </div>
        <button type="button" onClick={save} className={btnPrimary}>
          저장
        </button>
        {msg && <p className="text-center text-sm text-neutral-500">{msg}</p>}
      </section>

      <Band />
      <section className="space-y-3 px-5 py-5">
        <h3 className={sectionTitle}>일행 초대</h3>
        {repo.mode === 'cloud' ? (
          <>
            <p className="text-sm text-neutral-500">이 링크를 받은 사람은 같은 여행을 보고 고칠 수 있어요. 일행에게만 보내 주세요.</p>
            <p className="break-all rounded-xl bg-neutral-50 px-3.5 py-3 text-xs text-neutral-400">{link}</p>
            <button type="button" onClick={shareTrip} className={btnPrimary}>
              {copied ? '복사했어요' : '링크 공유하기'}
            </button>
          </>
        ) : (
          <p className="text-sm text-neutral-500">
            지금은 <b className="text-neutral-700">이 기기에만 저장</b>돼요. Firebase를 연결하면 링크로 일행과 같이 쓸 수 있어요.
          </p>
        )}
      </section>

      <Band />
      <section className="space-y-3 px-5 py-5">
        <h3 className={sectionTitle}>백업</h3>
        <p className="text-sm text-neutral-500">일정과 가계부를 파일 하나로 저장하거나 다시 불러와요.</p>
        <div className="flex gap-2">
          <button type="button" onClick={exportBackup} className={btnLine}>
            내보내기
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className={btnLine}>
            가져오기
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void importBackup(f)
            }}
          />
        </div>
      </section>

      <Band />
      <section className="space-y-1.5 px-5 py-5 text-sm text-neutral-500">
        <h3 className={`${sectionTitle} mb-2`}>홈 화면에 앱으로 추가</h3>
        <p>
          <b className="text-neutral-700">아이폰</b> 사파리 공유 버튼 → 홈 화면에 추가
        </p>
        <p>
          <b className="text-neutral-700">안드로이드</b> 크롬 메뉴(⋮) → 홈 화면에 추가
        </p>
        <p className="pt-2 text-xs text-neutral-400">지도 地理院タイル(국토지리원) · 장소 검색 © OpenStreetMap (Nominatim)</p>
      </section>

      <Band />
      <button type="button" onClick={onLeave} className="w-full py-5 text-sm font-medium text-neutral-500 active:bg-neutral-50">
        다른 여행 보기 · 새 여행 만들기
      </button>
    </div>
  )
}
