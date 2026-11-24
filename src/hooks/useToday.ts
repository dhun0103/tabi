import { useEffect, useState } from 'react'
import { todayStr } from '../lib/util'

/** 앱으로 돌아왔을 때 (폰에서 다른 앱을 쓰다 오거나, 밤새 뒤에 재워 둔 앱을 아침에 다시 열 때) */
export function onAppShown(fn: () => void): () => void {
  const handler = () => {
    if (document.visibilityState === 'visible') fn()
  }
  document.addEventListener('visibilitychange', handler)
  window.addEventListener('focus', handler)
  return () => {
    document.removeEventListener('visibilitychange', handler)
    window.removeEventListener('focus', handler)
  }
}

/**
 * 오늘 날짜 (YYYY-MM-DD). 자정이 지나면, 그리고 앱으로 돌아오면 새 날짜로 다시 그림
 * (폰은 뒤에 있는 앱의 타이머를 멈추므로 자정 타이머만으로는 모자라서 돌아올 때도 확인)
 */
export function useToday(): string {
  const [today, setToday] = useState(todayStr)
  useEffect(() => {
    let timer = 0
    const check = () => {
      setToday(todayStr()) // 같은 날이면 다시 그리지 않음
      window.clearTimeout(timer)
      const now = new Date()
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
      timer = window.setTimeout(check, midnight - now.getTime() + 1000) // 자정 1초 뒤
    }
    check()
    const off = onAppShown(check)
    return () => {
      window.clearTimeout(timer)
      off()
    }
  }, [])
  return today
}
