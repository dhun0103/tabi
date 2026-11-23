import { useEffect, useRef, useState, type ReactNode } from 'react'
import { fetchJpyRate, type JpyRate } from '../lib/rate'
import { fmtDay } from '../lib/util'
import { Field, inputCls } from './ui'

interface Props {
  value: string
  onChange: (v: string) => void
  hint?: ReactNode // 평소 안내 문구 (없으면 비워 둠. [오늘 환율]을 누른 뒤엔 기준 날짜·출처 안내가 나옴)
  label?: string
  needsSave?: boolean // 불러온 뒤 [저장]을 눌러야 반영되는 화면 (설정)
  onPicked?: (r: JpyRate | null) => void // 불러온 환율로 채웠으면 그 정보, 사람이 직접 고쳤으면 null
}

type Status = 'idle' | 'loading' | 'done' | 'error'

/** 환율 출처 표시 (ExchangeRate-API는 무료로 쓰는 대신 링크를 달아 달라고 함) */
export function RateCredit({ source }: { source: JpyRate['source'] }) {
  return source === 'exchangerate-api' ? (
    <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
      Exchange Rate API
    </a>
  ) : (
    <>유럽중앙은행</>
  )
}

/**
 * 환율 입력칸 + [오늘 환율] 버튼
 *   버튼 → 최신 시장 환율로 칸을 채움 → 환전·카드 환율이 있으면 사람이 고쳐 씀
 */
export function RateField({ value, onChange, hint, label = '환율 (100엔 = ?원)', needsSave = false, onPicked }: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [info, setInfo] = useState<JpyRate | null>(null)
  // 불러오는 동안 부모가 다시 그려져도 최신 onChange·onPicked를 쓰려고 따로 들고 있음
  const latest = useRef({ onChange, onPicked })
  useEffect(() => {
    latest.current = { onChange, onPicked }
  })

  const load = async () => {
    setStatus('loading')
    try {
      const r = await fetchJpyRate()
      latest.current.onChange(String(r.per100))
      latest.current.onPicked?.(r)
      setInfo(r)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  const note =
    status === 'loading' ? (
      '최신 환율을 불러오는 중…'
    ) : status === 'error' ? (
      <span className="text-red-600">환율을 불러오지 못했어요. 인터넷 연결을 확인하거나 직접 적어 주세요.</span>
    ) : status === 'done' && info ? (
      <>
        <span className="font-medium text-neutral-600">{fmtDay(info.date)} 기준</span> 시장 환율(수수료 제외) · <RateCredit source={info.source} />.
        {needsSave ? ' 아래 [저장]을 눌러야 반영돼요.' : ' 카드·환전 환율이 있으면 그 숫자로 고쳐도 돼요.'}
      </>
    ) : (
      hint
    )

  return (
    <Field label={label} hint={note}>
      {/* Field가 label이라 안쪽은 span으로 */}
      <span className="flex gap-2">
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            onPicked?.(null)
            if (status === 'done' || status === 'error') setStatus('idle')
          }}
          inputMode="decimal"
          placeholder="100엔이 몇 원인지"
          className={`${inputCls} min-w-0 flex-1`}
        />
        <button
          type="button"
          onClick={() => void load()}
          disabled={status === 'loading'}
          className="shrink-0 rounded-xl border border-neutral-200 bg-white px-3.5 text-sm font-medium text-neutral-700 active:bg-neutral-50 disabled:opacity-40"
        >
          오늘 환율
        </button>
      </span>
    </Field>
  )
}
