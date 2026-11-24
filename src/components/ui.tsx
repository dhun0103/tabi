import { useEffect, useRef, type ReactNode } from 'react'
import { showAlert } from './ConfirmDialog'

/*
 * 트리플 톤: 흰 카드 + 파란 버튼(선택된 Day·주요 버튼), 회색 알약 칩, 민트 아이콘
 * 색 값은 아래 상수 하나로 모아 둔다
 */
export const BLUE = '#2F87F2' // 주요 버튼·선택 상태 (흰 글자 대비 3.6:1, 굵은 글자용)
export const MINT = '#0E9A90' // 가계부 카테고리 아이콘 (흰 바탕 대비 3.4:1)
export const MINT_SOFT = '#E8F6F5' // 카테고리 알약 바탕 (연한 민트)
export const MINT_INK = '#0A6E67' // 카테고리 알약 글자·아이콘 (MINT_SOFT 바탕 대비 5.5:1)

export const cardCls = 'rounded-2xl bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05),0_4px_14px_rgba(16,24,40,0.06)]'
export const inputCls =
  'w-full rounded-xl bg-neutral-100 px-3.5 py-3 text-base text-neutral-900 outline-none placeholder:text-neutral-400 focus:bg-white focus:ring-2 focus:ring-[#2F87F2]'
export const btnPrimary =
  'w-full rounded-xl bg-[#2F87F2] px-4 py-3.5 text-[15px] font-semibold text-white active:bg-[#2370D0] disabled:opacity-30'
export const btnOutline =
  'w-full rounded-xl border border-neutral-300 bg-white px-4 py-3.5 text-[15px] font-semibold text-neutral-700 active:bg-neutral-50'
export const btnGhost =
  'inline-flex items-center justify-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 shadow-sm ring-1 ring-neutral-200 active:bg-neutral-100'
export const btnDanger = 'shrink-0 rounded-xl px-4 py-3.5 text-[15px] font-medium text-red-600 active:bg-red-50'
export const sectionTitle = 'text-[15px] font-bold text-neutral-900'

/** 섹션 사이 간격 (카드 사이) */
export const Band = () => <div className="h-3" />

/** 흰 카드 섹션 */
export function Card(props: { children: ReactNode; className?: string }) {
  return <section className={`${cardCls} mx-4 ${props.className ?? ''}`}>{props.children}</section>
}

/**
 * 화면 아래에서 올라오는 창: 제목 + 오른쪽 X 하나
 * subtitle: 제목 바로 아래 줄 (스크롤 영역 밖이라 잘리지 않음)
 */
export function Sheet(props: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; subtitle?: ReactNode }) {
  const { title, onClose, children, footer, subtitle } = props
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
        <div className={`flex items-start gap-3 px-5 pt-2 ${subtitle ? 'pb-3' : 'pb-1'}`}>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="truncate text-[18px] font-bold leading-snug">{title}</h2>
            {subtitle && <div className="mt-1">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="-mr-2 -mt-1 shrink-0 rounded-full p-2 text-neutral-400 active:bg-neutral-100"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
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

/** 회색 알약 칩, 고르면 파랑 */
export function Chip(props: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={props.active}
      onClick={props.onClick}
      className={`shrink-0 rounded-full px-3.5 py-2 text-sm transition-colors ${
        props.active ? 'bg-[#2F87F2] font-semibold text-white' : 'bg-[#F3F3F3] text-neutral-600 active:bg-neutral-200'
      }`}
    >
      {props.children}
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
  void showAlert('저장하지 못했어요', `${msg}${hint}`)
}
