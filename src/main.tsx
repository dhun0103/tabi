import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { UpdateBanner } from './components/UpdateBanner'
// 프리텐다드: 화면에 나온 글자가 든 조각(woff2)만 내려받는 방식
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {/* 시작 화면·여행 화면 어디서든 새 버전 알림 */}
    <UpdateBanner />
  </StrictMode>,
)
