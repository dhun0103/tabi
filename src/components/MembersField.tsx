import type { ReactNode } from 'react'
import { inputCls } from './ui'

/** 적어 둔 이름을 일행에 더함 (빈칸·같은 이름은 무시). [추가]를 안 누르고 바로 저장해도 들어가게 저장할 때도 씀 */
export function addName(members: string[], name: string): string[] {
  const n = name.trim()
  return n && !members.includes(n) ? [...members, n] : members
}

/**
 * 일행 칸 (새 여행 만들기 · 설정 공용): 이름 칩(✕로 빼기) + [이름 추가] 칸 · [추가] 버튼
 * 쉼표로 이어 쓰는 대신 한 명씩 추가. Enter로도 추가 (한글 입력 중의 Enter는 무시해서 글자가 남지 않게)
 */
export function MembersField(props: {
  members: string[]
  onChange: (members: string[]) => void
  draft: string // 아직 [추가] 안 누른, 칸에 적힌 이름
  onDraft: (s: string) => void
  hint?: ReactNode
}) {
  const { members, onChange, draft, onDraft, hint } = props
  const add = () => {
    onChange(addName(members, draft))
    onDraft('')
  }

  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-neutral-500">일행</span>
      {members.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {members.map((m) => (
            <span key={m} className="inline-flex items-center gap-1 rounded-full bg-neutral-100 py-1.5 pl-3.5 pr-1.5 text-sm">
              {m}
              <button
                type="button"
                onClick={() => onChange(members.filter((x) => x !== m))}
                aria-label={`${m} 빼기`}
                className="flex h-5 w-5 items-center justify-center rounded-full text-xs text-neutral-400 active:bg-neutral-200"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
            e.preventDefault()
            add()
          }}
          enterKeyHint="done"
          placeholder="이름 추가"
          aria-label="일행 이름 추가"
          className={inputCls}
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="shrink-0 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 active:bg-neutral-50 disabled:opacity-40"
        >
          추가
        </button>
      </div>
      {hint && <span className="mt-1.5 block text-xs leading-relaxed text-neutral-400">{hint}</span>}
    </div>
  )
}
