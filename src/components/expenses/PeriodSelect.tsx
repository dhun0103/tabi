import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { BLUE } from '../ui'

export interface Period {
  value: string
  label: string // "기간 전체", "여행 준비", "Day 1"
  sub?: string // 회색 보조 글 ("12/5(토)")
}

/**
 * 기간 고르기 (가계부 · 카테고리별 지출 페이지 공용)
 * 기본 select 목록은 폰·PC 기본 모양으로 떠서 앱과 안 어울림 → 직접 그린 드롭다운
 *   버튼: Day 칩과 같은 흰 알약 (variant="line"은 지출내역 페이지의 얇은 테두리)
 *   목록: 흰 카드 + 그림자, 고른 항목은 파랑 글자 + 체크
 * 닫기: 바깥 누르기 · Esc (Esc는 이 목록만 닫고, 바깥 페이지는 그대로)
 * 키보드: ↓로 열기, ↑↓로 이동, Enter로 고르기
 */
export function PeriodSelect(props: { periods: Period[]; value: string; onChange: (v: string) => void; variant?: 'pill' | 'line'; align?: 'left' | 'right' }) {
  const { periods, value, onChange, variant = 'pill', align = 'left' } = props
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const current = periods.find((p) => p.value === value) ?? periods[0]

  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus()
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    // 바깥(카테고리 페이지)의 Esc 닫기보다 먼저 받아서 목록만 닫음
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const pick = (v: string) => {
    onChange(v)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const moveFocus = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
  }

  const triggerCls =
    variant === 'pill'
      ? 'rounded-full bg-white px-3.5 py-2 font-semibold text-neutral-700 shadow-sm ring-1 ring-neutral-200'
      : 'rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-neutral-600'

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`기간: ${current?.label ?? ''}${current?.sub ? ` ${current.sub}` : ''}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] active:bg-neutral-50 ${triggerCls}`}
      >
        <span>{current?.label}</span>
        {current?.sub && <span className="font-normal text-neutral-400">{current.sub}</span>}
        <svg
          viewBox="0 0 24 24"
          className={`h-3.5 w-3.5 text-neutral-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          aria-label="기간"
          onKeyDown={moveFocus}
          className={`absolute top-full z-40 mt-1.5 min-w-[188px] rounded-2xl bg-white py-1.5 shadow-[0_10px_28px_rgba(16,24,40,0.14)] ring-1 ring-black/5 ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {periods.map((p) => {
            const on = p.value === value
            return (
              <button
                key={p.value}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => pick(p.value)}
                className={`flex w-full items-center justify-between gap-4 whitespace-nowrap px-4 py-2.5 text-left text-[14px] outline-none hover:bg-neutral-50 focus-visible:bg-neutral-100 ${on ? 'font-semibold' : 'text-neutral-700'}`}
                style={on ? { color: BLUE } : undefined}
              >
                <span>
                  {p.label}
                  {p.sub && (
                    <>
                      {' '}
                      <span className={`ml-0.5 font-normal ${on ? 'opacity-70' : 'text-neutral-400'}`}>{p.sub}</span>
                    </>
                  )}
                </span>
                {on ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                ) : (
                  <span className="h-4 w-4 shrink-0" aria-hidden="true" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
