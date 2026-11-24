import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { areaLabel } from '../../lib/geo'
import { shrinkPhoto } from '../../lib/photo'
import { categoryOf, expenseKRW, fmtKRW, fmtMoney, kindLabel, newId } from '../../lib/util'
import { repo } from '../../store'
import type { Expense, Photo, Plan } from '../../types'
import { CategoryIcon, MemoIcon } from '../icons'
import { TimeDialog } from '../TimePicker'
import { MINT_INK, MINT_SOFT, Sheet, btnPrimary, inputCls, reportError } from '../ui'

interface Props {
  tripId: string
  plan: Plan
  expenses: Expense[] // 이 장소에 연결된 지출
  rate: number // 기본 환율 (환율이 저장 안 된 예전 지출용)
  suggestTime: string // 시간이 없을 때 시간 창에 먼저 보여 줄 값
  onUpdate: (changes: Pick<Partial<Plan>, 'time' | 'memo'>) => void
  onAddExpense: () => void
  onOpenExpense: (e: Expense) => void
  onEdit: () => void
  onClose: () => void
}

/**
 * 장소를 누르면 아래에서 올라오는 작은 카드 (NOL 일정 화면처럼)
 *   이름 · 종류·동네
 *   🕒 시간 (누르면 24시간 시간 창) · ≡ 메모 (누르면 바로 쓰기) · 📷 사진 · 이 장소에서 쓴 돈
 *   [지출 추가]  ·  일정 수정·삭제
 * 상세 보기(평점·영업시간 등)는 없음 → 구글 장소 상세 요청도 하지 않음
 */
export function DetailSheet({ tripId, plan, expenses, rate, suggestTime, onUpdate, onAddExpense, onOpenExpense, onEdit, onClose }: Props) {
  const [timeOpen, setTimeOpen] = useState(false)
  const [memoOpen, setMemoOpen] = useState(false)
  const [memoText, setMemoText] = useState('')
  const total = expenses.reduce((a, e) => a + expenseKRW(e, rate), 0) // 지출마다 적을 때의 환율
  const meta = [kindLabel(plan.kind), areaLabel(plan)].filter(Boolean).join(' · ')

  return (
    <Sheet title={plan.title} subtitle={meta ? <p className="text-[13px] text-neutral-500">{meta}</p> : undefined} onClose={onClose}>
      <div className="-mt-1">
        <Row icon={<ClockIcon />} label="시간" onClick={() => setTimeOpen(true)}>
          {plan.time ? <span className="font-semibold tabular-nums text-neutral-900">{plan.time}</span> : <span className="text-neutral-400">시간 추가</span>}
        </Row>

        {memoOpen ? (
          <div className="py-2">
            <textarea
              value={memoText}
              onChange={(e) => setMemoText(e.target.value)}
              rows={3}
              autoFocus
              placeholder="예약번호, 꼭 먹을 메뉴…"
              aria-label="메모"
              className={inputCls}
            />
            <div className="mt-2 flex justify-end gap-1.5">
              <button type="button" onClick={() => setMemoOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-500 active:bg-neutral-100">
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdate({ memo: memoText.trim() })
                  setMemoOpen(false)
                }}
                className="rounded-lg bg-[#2F87F2] px-3.5 py-2 text-sm font-semibold text-white active:bg-[#2370D0]"
              >
                저장
              </button>
            </div>
          </div>
        ) : (
          <Row
            icon={<MemoIcon className={iconCls} />}
            label="메모"
            onClick={() => {
              setMemoText(plan.memo)
              setMemoOpen(true)
            }}
          >
            {plan.memo ? <span className="whitespace-pre-wrap text-neutral-700">{plan.memo}</span> : <span className="text-neutral-400">메모 추가</span>}
          </Row>
        )}

        <PlacePhotos tripId={tripId} planId={plan.id} />

        {expenses.length > 0 && (
          <div className="py-2.5">
            {/* pr-3: 아래 상자 안쪽 여백만큼 들여서 합계와 내역 금액의 오른쪽 끝을 한 줄에 맞춤 */}
            <div className="flex items-center gap-3 pr-3 text-[15px]">
              <span className="text-neutral-500">
                <WalletIcon />
              </span>
              <span className="flex-1 text-neutral-700">이 장소에서 쓴 돈</span>
              <span className="font-bold tabular-nums">{fmtKRW(total)}</span>
            </div>
            {/* 내역이 위 합계에 들어 있는 느낌: 합계 글자 줄에 맞춘 연한 회색 상자로 묶고, 금액은 합계보다 한 단계 가볍게 */}
            <ul className="ml-8 mt-2 divide-y divide-black/[0.05] rounded-xl bg-[#F5F6F8] px-3">
              {expenses.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => onOpenExpense(e)} className="flex w-full items-center gap-2 py-2.5 text-left text-[14px] active:opacity-70">
                    {/* 카테고리는 늘 맨 앞에 민트 알약(아이콘 + 이름), 그 뒤에 지출 이름 (이름이 없으면 비워 둠) */}
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full py-0.5 pl-1.5 pr-2 text-[12px] font-semibold" style={{ background: MINT_SOFT, color: MINT_INK }}>
                      <CategoryIcon category={e.category} className="h-3.5 w-3.5" />
                      {categoryOf(e.category).label}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-neutral-700">{e.title}</span>
                    <span className="font-medium tabular-nums text-neutral-600">{fmtMoney(e.amount, e.currency)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <button type="button" onClick={onAddExpense} className={btnPrimary}>
          지출 추가
        </button>
        <button type="button" onClick={onEdit} className="mx-auto mt-3 block px-2 py-1 text-[13px] text-neutral-400 underline underline-offset-2">
          일정 수정·삭제
        </button>
      </div>

      {timeOpen && (
        <TimeDialog
          start={plan.time || suggestTime}
          hasValue={Boolean(plan.time)}
          onDone={(v) => {
            onUpdate({ time: v })
            setTimeOpen(false)
          }}
          onClose={() => setTimeOpen(false)}
        />
      )}
    </Sheet>
  )
}

/**
 * 이 장소 사진: [사진 추가] → 폰 사진첩/카메라 → 줄여서 저장 → 3칸 바둑판, 누르면 크게 보기·삭제
 * 카드를 열 때 그 장소 사진만 받아 온다 (일행이 올린 사진도 같이 보임)
 */
function PlacePhotos({ tripId, planId }: { tripId: string; planId: string }) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState('')
  const [viewing, setViewing] = useState<Photo | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => repo.watchPhotos(tripId, planId, setPhotos, (e) => setError(`사진을 불러오지 못했어요: ${e.message}`)), [tripId, planId])

  const add = async (files: File[]) => {
    setError('')
    setUploading((n) => n + files.length)
    for (const file of files) {
      try {
        const small = await shrinkPhoto(file)
        // 오프라인이면 서버 응답을 기다리지 않음 (화면엔 바로 보이고 연결되면 올라감)
        repo.savePhoto(tripId, { id: newId(), planId, ...small, createdAt: Date.now() }).catch(reportError)
      } catch (e) {
        setError(e instanceof Error ? e.message : '사진을 넣지 못했어요')
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }

  return (
    <div>
      <Row icon={<CameraIcon />} label="사진" onClick={() => inputRef.current?.click()}>
        {photos.length > 0 ? <span className="text-neutral-700">사진 {photos.length}장 · <span className="font-semibold text-[#2F87F2]">추가</span></span> : <span className="text-neutral-400">사진 추가</span>}
      </Row>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])].filter((f) => f.type.startsWith('image/') || !f.type)
          e.target.value = '' // 같은 사진을 다시 골라도 동작하게
          if (files.length) void add(files)
        }}
      />
      {(photos.length > 0 || uploading > 0) && (
        <div className="grid grid-cols-3 gap-1.5 pb-2 pl-8">
          {photos.map((p) => (
            <button key={p.id} type="button" onClick={() => setViewing(p)} className="aspect-square overflow-hidden rounded-lg bg-neutral-100">
              <img src={p.data} alt="장소 사진" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
          {Array.from({ length: uploading }, (_, i) => (
            <div key={`up-${i}`} className="flex aspect-square items-center justify-center rounded-lg bg-neutral-100 text-xs text-neutral-400">
              올리는 중…
            </div>
          ))}
        </div>
      )}
      {error && <p className="pb-2 pl-8 text-sm text-red-600">{error}</p>}
      {viewing && (
        <PhotoViewer
          photo={viewing}
          onDelete={() => {
            if (!confirm('이 사진을 지울까요?')) return
            repo.deletePhoto(tripId, viewing.id).catch(reportError)
            setViewing(null)
          }}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}

/** 사진 크게 보기 (검은 화면 + 닫기·삭제). Esc는 이 창만 닫음 */
function PhotoViewer({ photo, onDelete, onClose }: { photo: Photo; onDelete: () => void; onClose: () => void }) {
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      closeRef.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="사진 보기" className="fixed inset-0 z-[60] flex flex-col bg-black">
      <div className="flex items-center justify-between px-2" style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
        <button type="button" onClick={onDelete} className="rounded-full px-3 py-2 text-[15px] font-medium text-red-400 active:bg-white/10">
          삭제
        </button>
        <button type="button" onClick={onClose} aria-label="닫기" className="rounded-full p-2.5 text-white active:bg-white/10">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-2" onClick={onClose}>
        <img src={photo.data} alt="장소 사진" className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
      </div>
    </div>,
    document.body,
  )
}

/** 아이콘 + 내용 한 줄 (누르면 그 자리에서 바꾸기) */
function Row({ icon, label, onClick, children }: { icon: ReactNode; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-start gap-3 py-2.5 text-left text-[15px] active:bg-neutral-50">
      <span className="mt-0.5 text-neutral-500">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="sr-only">{label}: </span>
        {children}
      </span>
    </button>
  )
}

const iconCls = 'h-5 w-5'
const ClockIcon = () => (
  <svg viewBox="0 0 24 24" className={iconCls} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)
const CameraIcon = () => (
  <svg viewBox="0 0 24 24" className={iconCls} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
    <circle cx="12" cy="13" r="3.2" />
  </svg>
)
const WalletIcon = () => (
  <svg viewBox="0 0 24 24" className={iconCls} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="6" width="18" height="13" rx="2.5" />
    <path d="M3 10h18M7 15h4" />
  </svg>
)
