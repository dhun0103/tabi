import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BLUE, btnOutline, btnPrimary, inputCls } from './ui'

const ITEM = 40 // 한 칸 높이(px)
const ROWS = 5 // 보이는 칸 수 (가운데 칸이 고른 값)
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

interface Props {
  value: string // 'HH:mm' 또는 '' (시간 미정)
  onChange: (v: string) => void
  suggest?: string // 비어 있을 때 창을 열면 먼저 보여 줄 시간
  label?: string
  className?: string
}

/**
 * 24시간 시간 고르기 (오전/오후 없음)
 *   칸을 누르면 "시간 추가" 창 → 시·분 두 줄을 굴려서 고르고 [완료]
 *   폰 기본 시간 입력은 언어 설정에 따라 오전/오후가 붙어서 직접 만듦
 */
export function TimePicker({ value, onChange, suggest = '12:00', label = '시간 (선택)', className = '' }: Props) {
  const [open, setOpen] = useState(false)
  return (
    // label 태그로 감싸면 이름표를 누를 때 버튼이 눌려서 div
    <div className={className}>
      <span className="mb-1.5 block text-[13px] font-medium text-neutral-500">{label}</span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`${inputCls} flex items-center justify-between gap-3 text-left`}
      >
        <span className={value ? 'tabular-nums' : 'text-neutral-400'}>{value || '시간 추가'}</span>
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 text-neutral-500" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </svg>
      </button>
      {open && (
        <TimeDialog
          start={value || suggest}
          hasValue={Boolean(value)}
          onDone={(v) => {
            onChange(v)
            setOpen(false)
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

function TimeDialog(props: { start: string; hasValue: boolean; onDone: (v: string) => void; onClose: () => void }) {
  const { start, hasValue, onDone, onClose } = props
  const [h0, m0] = start.split(':')
  const [hour, setHour] = useState(HOURS.includes(h0) ? h0 : '12')
  const [minute, setMinute] = useState(MINUTES.includes(m0) ? m0 : '00')

  // Esc는 이 창만 닫기: 뒤에 있는 장소 창(Sheet)도 Esc를 듣고 있어서, 먼저(캡처 단계) 받아서 멈춤
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="시간 고르기" className="relative w-full max-w-[320px] rounded-2xl bg-white px-5 pb-5 pt-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-[17px] font-bold">{hasValue ? '시간 변경' : '시간 추가'}</h3>
          <button type="button" onClick={onClose} aria-label="닫기" className="-mr-2 rounded-full p-2 text-neutral-400 active:bg-neutral-100">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-1">
          <Wheel values={HOURS} value={hour} onChange={setHour} label="시" />
          <span className="pb-0.5 text-xl font-bold text-neutral-300" aria-hidden="true">
            :
          </span>
          <Wheel values={MINUTES} value={minute} onChange={setMinute} label="분" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className={btnOutline}>
            취소
          </button>
          <button type="button" onClick={() => onDone(`${hour}:${minute}`)} className={btnPrimary}>
            완료
          </button>
        </div>
        {hasValue && (
          <button type="button" onClick={() => onDone('')} className="mx-auto mt-3 block text-[13px] text-neutral-500 underline underline-offset-2">
            추가한 시간 삭제하기
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}

/** 위아래로 굴리는 한 줄 (가운데 칸에 멈춘 값이 고른 값) */
function Wheel(props: { values: string[]; value: string; onChange: (v: string) => void; label: string }) {
  const { values, value, onChange, label } = props
  const ref = useRef<HTMLDivElement>(null)
  const index = Math.max(0, values.indexOf(value))

  // 처음 열 때 고른 값이 가운데 오게
  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = index * ITEM
    // 처음 한 번만
  }, [])

  const go = (i: number) => ref.current?.scrollTo({ top: Math.min(values.length - 1, Math.max(0, i)) * ITEM, behavior: 'smooth' })

  return (
    <div className="relative" style={{ height: ITEM * ROWS }}>
      {/* 가운데 칸 표시 */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-1 rounded-xl bg-[#EEF4FF]" style={{ top: ITEM * 2, height: ITEM }} />
      <div
        ref={ref}
        role="listbox"
        aria-label={label}
        tabIndex={0}
        onScroll={(e) => {
          const i = Math.min(values.length - 1, Math.max(0, Math.round(e.currentTarget.scrollTop / ITEM)))
          if (values[i] !== value) onChange(values[i])
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            go(index + (e.key === 'ArrowDown' ? 1 : -1))
          }
        }}
        className="relative h-full snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#2F87F2] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ paddingBlock: ITEM * 2 }}
      >
        {values.map((v, i) => (
          <button
            key={v}
            type="button"
            role="option"
            aria-selected={v === value}
            tabIndex={-1}
            onClick={() => go(i)}
            className={`flex w-full snap-center items-center justify-center text-[19px] tabular-nums ${v === value ? 'font-bold' : 'text-neutral-300'}`}
            style={{ height: ITEM, color: v === value ? BLUE : undefined }}
          >
            {v}
          </button>
        ))}
      </div>
      {/* 위아래 흐리게 */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-10" style={{ background: 'linear-gradient(#fff, rgba(255,255,255,0))' }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-10" style={{ background: 'linear-gradient(rgba(255,255,255,0), #fff)' }} />
    </div>
  )
}
