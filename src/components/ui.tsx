import { useEffect, useRef, type ReactNode } from 'react'

/* 흑백 위주 심플 톤: 흰 배경, 회색 입력칸, 검정 버튼, 섹션은 얇은 회색 띠로 구분 */

export const inputCls =
  'w-full rounded-xl bg-neutral-100 px-3.5 py-3 text-base text-neutral-900 outline-none placeholder:text-neutral-400 focus:bg-white focus:ring-2 focus:ring-neutral-900'
export const btnPrimary =
  'w-full rounded-xl bg-neutral-900 px-4 py-3.5 text-[15px] font-semibold text-white active:bg-neutral-700 disabled:opacity-30'
export const btnGhost =
  'inline-flex items-center justify-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 active:bg-neutral-100'
export const btnDanger = 'shrink-0 rounded-xl px-4 py-3.5 text-[15px] font-medium text-red-600 active:bg-red-50'
export const sectionTitle = 'text-[15px] font-bold text-neutral-900'

/** 섹션 사이 회색 띠 */
export const Band = () => <div className="h-2 bg-neutral-100" />

/** 화면 아래에서 올라오는 입력 창 */
export function Sheet(props: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const { title, onClose, children, footer } = props
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl bg-white"
      >
        <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-neutral-200" aria-hidden="true" />
        <div className="flex items-center justify-between px-5 pb-1 pt-2">
          <h2 className="text-[17px] font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="-mr-2 p-2 text-lg leading-none text-neutral-400">
            ✕
          </button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-5 pt-2">{children}</div>
        {footer && (
          <div className="border-t border-neutral-100 px-5 pt-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/** 입력칸 + 이름표 (input/select/textarea 용) */
export function Field(props: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-neutral-500">{props.label}</span>
      {props.children}
      {props.hint && <span className="mt-1.5 block text-xs leading-relaxed text-neutral-400">{props.hint}</span>}
    </label>
  )
}

/** 버튼 묶음 + 이름표 (label 안에 버튼을 넣으면 이름표 클릭이 첫 버튼을 눌러버려서 div 사용) */
export function Group(props: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={props.label}>
      <span className="mb-1.5 block text-[13px] font-medium text-neutral-500">{props.label}</span>
      <div className="flex flex-wrap gap-1.5">{props.children}</div>
    </div>
  )
}

export function Chip(props: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={props.active}
      onClick={props.onClick}
      className={`shrink-0 rounded-full px-3.5 py-2 text-sm transition-colors ${
        props.active ? 'bg-neutral-900 font-medium text-white' : 'bg-neutral-100 text-neutral-600 active:bg-neutral-200'
      }`}
    >
      {props.children}
    </button>
  )
}

/** 오른쪽 아래 + 버튼 */
export function Fab(props: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-label={props.label}
      className="fixed z-30 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg shadow-black/20 active:scale-95"
      style={{ right: 'max(16px, calc(50vw - 256px + 16px))', bottom: 'calc(76px + env(safe-area-inset-bottom))' }}
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  )
}

export function Empty(props: { icon: string; title: string; desc?: string }) {
  return (
    <div className="py-14 text-center">
      <p className="text-3xl">{props.icon}</p>
      <p className="mt-3 text-[15px] font-medium text-neutral-700">{props.title}</p>
      {props.desc && <p className="mt-1 text-sm text-neutral-400">{props.desc}</p>}
    </div>
  )
}

export function reportError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e)
  const hint = /permission/i.test(msg) ? '\n\nFirebase 콘솔에서 Firestore 규칙을 게시했는지 확인해 주세요.' : ''
  alert(`저장하지 못했어요: ${msg}${hint}`)
}
