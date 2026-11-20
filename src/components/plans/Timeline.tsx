import { distanceM, hasCoords, travelHint } from '../../lib/geo'
import type { Plan } from '../../types'

interface Props {
  items: Plan[] // 순서대로 정렬된 하루치
  color: { bg: string; ink: string }
  activeId: string | null
  editing: boolean
  onOpen: (p: Plan) => void
  onFocus: (p: Plan) => void
  onMove: (index: number, delta: -1 | 1) => void
}

/** 번호 원 + 세로선 타임라인. 메모는 번호 없이 회색 쪽지로, 장소 사이엔 거리·도보 시간 */
export function Timeline({ items, color, activeId, editing, onOpen, onFocus, onMove }: Props) {
  let n = 0
  return (
    <ol>
      {items.map((p, idx) => {
        const last = idx === items.length - 1
        const arrows = editing && (
          <div className="flex shrink-0 flex-col gap-1 pt-1.5">
            <ArrowButton label="위로" disabled={idx === 0} onClick={() => onMove(idx, -1)} d="M6 15l6-6 6 6" />
            <ArrowButton label="아래로" disabled={last} onClick={() => onMove(idx, 1)} d="M6 9l6 6 6-6" />
          </div>
        )

        if (p.type === 'memo') {
          return (
            <li key={p.id} id={`plan-${p.id}`} className="flex gap-3">
              <div className="flex w-7 shrink-0 flex-col items-center">
                <span className="mt-4 h-2 w-2 shrink-0 rounded-full bg-neutral-300" aria-hidden="true" />
                {!last && <div className="mt-1 w-px flex-1 bg-neutral-200" />}
              </div>
              <div className="flex min-w-0 flex-1 gap-2 pb-4 pt-1.5">
                <button
                  type="button"
                  onClick={() => onOpen(p)}
                  className="min-w-0 flex-1 whitespace-pre-wrap rounded-lg bg-neutral-50 px-3 py-2 text-left text-[13px] leading-relaxed text-neutral-600"
                >
                  <span aria-hidden="true">📝 </span>
                  {p.title}
                </button>
                {arrows}
              </div>
            </li>
          )
        }

        n += 1
        const num = n
        const pinned = hasCoords(p)
        const next = items.slice(idx + 1).find((x) => x.type === 'place')
        const hint = next && pinned && hasCoords(next) ? travelHint(distanceM(p, next)) : null
        const meta = [p.time, p.kind, p.area, pinned ? '' : '지도 위치 없음'].filter(Boolean).join(' · ')
        const active = p.id === activeId
        return (
          <li key={p.id} id={`plan-${p.id}`} className="flex gap-3">
            <div className="flex w-7 shrink-0 flex-col items-center">
              <button
                type="button"
                onClick={() => pinned && onFocus(p)}
                aria-label={pinned ? `${num}번 ${p.title} 지도에서 보기` : `${num}번 (지도 위치 없음)`}
                className={`mt-2.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold transition-transform ${
                  active ? 'scale-110 ring-2 ring-neutral-900 ring-offset-2' : ''
                }`}
                style={pinned ? { background: color.bg, color: color.ink } : { background: '#e5e5e5', color: '#737373' }}
              >
                {num}
              </button>
              {!last && <div className="w-px flex-1 bg-neutral-200" />}
            </div>
            <div className="min-w-0 flex-1 pb-5">
              <div className="flex gap-2">
                <button type="button" onClick={() => onOpen(p)} className="block min-w-0 flex-1 pt-2.5 text-left">
                  <p className="text-[15px] font-semibold leading-snug">{p.title}</p>
                  {meta && <p className="mt-0.5 text-[13px] text-neutral-500">{meta}</p>}
                  {p.memo && (
                    <p className="mt-2 line-clamp-3 whitespace-pre-wrap rounded-lg bg-neutral-50 px-3 py-2 text-[13px] leading-relaxed text-neutral-600">
                      {p.memo}
                    </p>
                  )}
                </button>
                {arrows}
              </div>
              {hint && !editing && <p className="mt-3 text-xs text-neutral-400">↓ {hint}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function ArrowButton(props: { label: string; disabled: boolean; onClick: () => void; d: string }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 active:bg-neutral-100 disabled:opacity-25"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d={props.d} />
      </svg>
    </button>
  )
}
