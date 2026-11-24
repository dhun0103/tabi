import { Component, type ErrorInfo, type ReactNode } from 'react'
import { saveCurrent } from '../lib/session'
import { btnOutline, btnPrimary } from './ui'

/*
 * 화면을 그리다가 오류가 나면 React는 화면 전체를 지워 버린다 (하얀 화면)
 * → 대신 안내 + [새로고침] [처음 화면으로]
 *   처음 화면으로: "지금 보던 여행" 기억만 지움 → 다시 켜도 같은 오류로 하얗게 되지 않음 (최근 여행 목록엔 남아 있음)
 * 새 버전 알림(UpdateBanner)은 이 바깥에 있어서, 고친 버전이 나오면 이 화면에서도 알림이 뜬다
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('화면 오류', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const goHome = () => {
      saveCurrent(null)
      history.replaceState(null, '', location.pathname) // 주소의 #t=… 도 지움
      location.reload()
    }
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#f4f5f8] px-8 text-center">
        <p className="text-4xl" aria-hidden="true">
          🧳
        </p>
        <h1 className="mt-4 text-[18px] font-bold text-neutral-900">화면을 보여 주다가 문제가 생겼어요</h1>
        <p className="mt-2 break-keep text-[14px] leading-relaxed text-neutral-500">
          새로고침해 보세요. 계속 이러면 처음 화면에서 여행을 다시 열어 주세요. 저장된 일정과 가계부는 그대로예요.
        </p>
        <div className="mt-6 flex w-full max-w-[320px] flex-col gap-2">
          <button type="button" onClick={() => location.reload()} className={btnPrimary}>
            새로고침
          </button>
          <button type="button" onClick={goHome} className={btnOutline}>
            처음 화면으로
          </button>
        </div>
        <p className="mt-6 max-w-[320px] break-all text-[11px] text-neutral-400">{error.message}</p>
      </div>
    )
  }
}
