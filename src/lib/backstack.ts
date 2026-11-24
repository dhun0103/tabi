import { useEffect, useRef } from 'react'

/*
 * 휴대폰 뒤로 가기 = 맨 위 창만 닫기 (앱이 꺼지거나 이전 페이지로 나가지 않게)
 *   창(아래에서 올라오는 창 · 사진 보기 · 시간 고르기 · 확인 창 · 카테고리 페이지)이 하나라도 열려 있으면
 *   방문 기록에 한 칸을 쌓아 둔다
 *     뒤로 가기 → 그 칸이 빠지면서(popstate) 맨 위 창만 닫음 → 아직 열린 창이 있으면 다시 한 칸
 *     ✕ · Esc · 저장으로 마지막 창이 닫히면 쌓아 둔 칸을 history.back()으로 치움
 *   창이 바뀌는 순간(상세 → 수정)엔 닫힘과 열림이 같이 일어나서, 한 박자 뒤에 맞춰 칸이 흔들리지 않게 함
 */

const stack: (() => void)[] = [] // 열린 창의 닫기 함수 (맨 뒤 = 맨 위 창)
let pushed = false // 우리가 쌓은 칸이 방문 기록 맨 위에 있나
let skipPops = 0 // 우리가 history.back() 해서 생기는 popstate는 무시
let timer = 0

function sync() {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    if (stack.length && !pushed) {
      history.pushState({ tabiOverlay: true }, '')
      pushed = true
    } else if (!stack.length && pushed) {
      pushed = false
      skipPops++
      history.back()
    }
  }, 0)
}

window.addEventListener('popstate', () => {
  if (skipPops > 0) {
    skipPops--
    return
  }
  if (!pushed) return
  pushed = false
  stack.pop()?.()
  sync()
})

// 창이 열린 채로 다른 여행 링크(#t=…)로 바뀌면 그 칸이 맨 위가 아님 → 나중에 back()으로 되돌리지 않음
window.addEventListener('hashchange', () => {
  pushed = false
})

/** 창이 떠 있는 동안 휴대폰 뒤로 가기로 닫히게 (active가 false면 안 함) */
export function useBackClose(onClose: () => void, active = true) {
  const ref = useRef(onClose)
  useEffect(() => {
    ref.current = onClose
  })
  useEffect(() => {
    if (!active) return
    const close = () => ref.current()
    stack.push(close)
    sync()
    return () => {
      const i = stack.indexOf(close)
      if (i >= 0) stack.splice(i, 1)
      sync()
    }
  }, [active])
}
