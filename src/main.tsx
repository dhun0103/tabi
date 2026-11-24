import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ConfirmHost } from './components/ConfirmDialog'
import { AppErrorBoundary } from './components/ErrorBoundary'
import { UpdateBanner } from './components/UpdateBanner'
// 프리텐다드: 화면에 나온 글자가 든 조각(woff2)만 내려받는 방식
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* 오류가 나도 하얀 화면 대신 [새로고침] [처음 화면으로] */}
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
    {/* 시작 화면·여행 화면 어디서든 새 버전 알림 (오류 화면에서도 뜨게 바깥에 둠) */}
    <UpdateBanner />
    {/* "삭제할까요?" 같은 앱 안 확인 창 (브라우저 기본 confirm 대신) */}
    <ConfirmHost />
  </StrictMode>,
)
