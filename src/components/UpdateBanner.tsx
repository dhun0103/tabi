import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { BLUE } from './ui'

const HOUR = 60 * 60 * 1000

/**
 * 새 버전 알림
 *   배포 → 폰이 뒤에서 새 버전을 받아 둠(대기) → 이 배너 → [새로고침]을 누르면 바로 새 버전
 *   입력하는 중이면 안 누르면 그만. 앱을 완전히 껐다 켜도 새 버전으로 바뀐다
 * 자리: 탭바 바로 위 (한 손으로 엄지가 닿는 곳, 화면 내용은 거의 안 가림)
 * 시트(입력 창)보다 아래 층(z-40)이라 입력 중엔 가려져서 방해하지 않는다
 */
export function UpdateBanner() {
  const [updating, setUpdating] = useState(false)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // 앱을 켤 때만 확인하면 홈 화면에서 돌아오는 아이폰은 못 알아챔
      // → 화면에 다시 보일 때마다 + 켜 둔 동안 1시간마다 새 버전 확인
      const check = () => {
        if (document.visibilityState === 'visible' && navigator.onLine) registration.update().catch(() => {})
      }
      document.addEventListener('visibilitychange', check)
      setInterval(check, HOUR)
    },
  })

  if (!needRefresh) return null

  const update = () => {
    setUpdating(true)
    void updateServiceWorker(true)
    // 새 버전으로 넘어가면 알아서 새로고침됨. 혹시 멈춰 있으면 직접 새로고침
    setTimeout(() => location.reload(), 4000)
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}>
      <div
        role="status"
        className="pointer-events-auto flex items-center gap-1 rounded-full bg-neutral-900 py-1.5 pl-4 pr-1.5 text-sm text-white shadow-lg shadow-black/20"
      >
        <span className="mr-2 whitespace-nowrap">{updating ? '새 버전으로 바꾸는 중…' : '새 버전이 나왔어요'}</span>
        <button
          type="button"
          onClick={update}
          disabled={updating}
          className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-white active:opacity-80 disabled:opacity-50"
          style={{ background: BLUE }}
        >
          새로고침
        </button>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          disabled={updating}
          aria-label="나중에"
          className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 active:bg-white/10"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
