import { useEffect, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

/*
 * 앱 안 확인 창 ("이 장소를 일정에서 뺄까요?" [취소] [삭제]) + 확인 버튼 하나짜리 알림
 * 브라우저 기본 confirm()/alert() 대신 쓰는 이유
 *   - Claude 앱 미리보기 같은 일부 내장 브라우저는 기본 창을 막아서 confirm()이 바로 "취소"가 됨 → 삭제가 안 됨
 *   - 기본 창은 "tabi-f5564.web.app 내용:"처럼 주소가 붙고 앱 모양과 안 어울림
 * 사용: if (!(await askConfirm({ title: '이 메모를 지울까요?', confirmLabel: '삭제', danger: true }))) return
 * <ConfirmHost />는 main.tsx에 한 번만 둔다
 */

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string // 기본 '확인'
  cancelLabel?: string | null // 기본 '취소', null이면 확인 버튼만 (알림)
  danger?: boolean // 빨간 확인 버튼 (삭제)
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

let pending: Pending | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((fn) => fn())

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function askConfirm(opts: ConfirmOptions): Promise<boolean> {
  // 확인 창을 그릴 곳이 없으면(있을 일은 없지만) 브라우저 기본 창으로
  if (!listeners.size) {
    const text = [opts.title, opts.message].filter(Boolean).join('\n')
    if (opts.cancelLabel === null) {
      alert(text)
      return Promise.resolve(true)
    }
    return Promise.resolve(confirm(text))
  }
  pending?.resolve(false) // 떠 있던 창이 있으면 취소로 닫고 새 창
  return new Promise((resolve) => {
    pending = { ...opts, resolve }
    emit()
  })
}

/** 확인 버튼 하나짜리 알림 (저장 실패 같은 오류) */
export function showAlert(title: string, message?: string): Promise<void> {
  return askConfirm({ title, message, cancelLabel: null }).then(() => undefined)
}

function settle(ok: boolean) {
  const p = pending
  if (!p) return
  pending = null
  emit()
  p.resolve(ok)
}

/**
 * 화면 가운데 작은 창. 바깥을 누르거나 Esc = 취소
 * 키 처리는 앱이 켜질 때 가장 먼저 등록돼서, 창이 떠 있으면 Esc가 뒤의 시트·사진 보기까지 닫지 않는다
 */
export function ConfirmHost() {
  const p = useSyncExternalStore(subscribe, () => pending)
  const boxRef = useRef<HTMLDivElement>(null)
  const firstRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!pending) return
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        settle(pending.cancelLabel === null) // 알림은 Esc도 "확인"
        return
      }
      if (e.key !== 'Tab') return
      // Tab은 창 안 버튼들 사이에서만 돈다
      const buttons = [...(boxRef.current?.querySelectorAll('button') ?? [])]
      if (!buttons.length) return
      const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
      const next = at === -1 ? 0 : (at + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length
      e.preventDefault()
      e.stopImmediatePropagation()
      buttons[next].focus()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  // 창이 뜨면 첫 버튼(취소)에 초점, 닫히면 원래 자리로 (그 자리가 아직 화면에 있으면)
  useEffect(() => {
    if (!p) return
    const back = document.activeElement as HTMLElement | null
    firstRef.current?.focus()
    return () => {
      if (back?.isConnected) back.focus()
    }
  }, [p])

  if (!p) return null
  const alertOnly = p.cancelLabel === null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-8">
      <div className="absolute inset-0 bg-black/45" onClick={() => settle(alertOnly)} aria-hidden="true" />
      <div
        ref={boxRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={p.message ? 'confirm-message' : undefined}
        className="relative w-full max-w-[320px] rounded-2xl bg-white px-5 pb-4 pt-6 text-center shadow-xl"
      >
        <h2 id="confirm-title" className="break-keep text-[17px] font-bold leading-snug text-neutral-900">
          {p.title}
        </h2>
        {p.message && (
          <p id="confirm-message" className="mt-1.5 whitespace-pre-line break-keep text-[14px] leading-relaxed text-neutral-500">
            {p.message}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          {!alertOnly && (
            <button
              ref={firstRef}
              type="button"
              onClick={() => settle(false)}
              className="flex-1 rounded-xl bg-neutral-100 py-3 text-[15px] font-semibold text-neutral-700 active:bg-neutral-200"
            >
              {p.cancelLabel ?? '취소'}
            </button>
          )}
          <button
            ref={alertOnly ? firstRef : undefined}
            type="button"
            onClick={() => settle(true)}
            className={`flex-1 rounded-xl py-3 text-[15px] font-semibold text-white ${
              p.danger ? 'bg-red-600 active:bg-red-700' : 'bg-[#2F87F2] active:bg-[#2370D0]'
            }`}
          >
            {p.confirmLabel ?? '확인'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
