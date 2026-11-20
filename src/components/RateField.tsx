import { useEffect, useRef, useState } from 'react'
import { fetchJpyRate, type JpyRate } from '../lib/rate'
import { fmtDay } from '../lib/util'
import { Field, inputCls } from './ui'

interface Props {
  value: string
  onChange: (v: string) => void
  hint: string // 평소 안내 문구
  autoFill?: boolean // 처음 열 때 비어 있으면 오늘 환율로 채우기 (새 여행 만들기)
  needsSave?: boolean // 불러온 뒤 [저장]을 눌러야 반영되는 화면 (설정)
}

type Status = 'idle' | 'loading' | 'done' | 'error'

/**
 * 환율 입력칸 + [오늘 환율] 버튼
 *   버튼 → 오늘 시장 환율로 칸을 채움 → 환전·충전한 환율이 있으면 사람이 고쳐 씀
 */
export function RateField({ value, onChange, hint, autoFill = false, needsSave = false }: Props) {
  const [status, setStatus] = useState<Status>(autoFill && !value ? 'loading' : 'idle')
  const [info, setInfo] = useState<JpyRate | null>(null)
  // 불러오는 동안 사람이 직접 적었으면 덮어쓰지 않으려고 최신 값을 따로 들고 있음
  const latest = useRef({ value, onChange })
  useEffect(() => {
    latest.current = { value, onChange }
  })

  const load = async (auto: boolean) => {
    setStatus('loading')
    try {
      const r = await fetchJpyRate()
      if (auto && latest.current.value.trim()) {
        setStatus('idle')
        return
      }
      latest.current.onChange(String(r.per100))
      setInfo(r)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  // 처음 열 때 한 번만
  useEffect(() => {
    if (autoFill && !latest.current.value.trim()) void load(true)
  }, [])

  const day = info?.date ? `${fmtDay(info.date)} ` : ''
  const note =
    status === 'loading' ? (
      '오늘 환율을 불러오는 중…'
    ) : status === 'error' ? (
      <span className="text-red-600">환율을 불러오지 못했어요. 인터넷 연결을 확인하거나 직접 적어 주세요.</span>
    ) : status === 'done' ? (
      <>
        <span className="font-medium text-neutral-600">{day}기준 시장 환율</span>(수수료 제외)로 채웠어요.
        {needsSave ? ' 아래 [저장]을 눌러야 반영돼요.' : ' 환전·충전한 환율이 있으면 그 숫자로 바꾸세요.'}
      </>
    ) : (
      hint
    )

  return (
    <Field label="환율 (100엔 = ?원)" hint={note}>
      {/* Field가 label이라 안쪽은 span으로 */}
      <span className="flex gap-2">
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            if (status === 'done' || status === 'error') setStatus('idle')
          }}
          inputMode="decimal"
          placeholder="100엔이 몇 원인지"
          className={`${inputCls} min-w-0 flex-1`}
        />
        <button
          type="button"
          onClick={() => void load(false)}
          disabled={status === 'loading'}
          className="shrink-0 rounded-xl border border-neutral-200 bg-white px-3.5 text-sm font-medium text-neutral-700 active:bg-neutral-50 disabled:opacity-40"
        >
          오늘 환율
        </button>
      </span>
    </Field>
  )
}
