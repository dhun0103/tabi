import { useEffect, useRef, useState } from 'react'
import { cachedJpyRate, fetchJpyRate } from '../../lib/rate'
import { CATEGORIES, METHODS, dayText, defaultDay, fmtDay, fmtKRW, newId, toKRW, tripDays } from '../../lib/util'
import { repo } from '../../store'
import type { Category, Currency, Expense, PayMethod, Plan, Trip } from '../../types'
import { RateField } from '../RateField'
import { BLUE, Chip, Field, Group, Sheet, btnDanger, btnPrimary, inputCls, reportError } from '../ui'

/**
 * 이 지출의 환율이 어디서 왔나
 *   latest 최신 환율을 불러옴 · saved 예전에 저장한 값 · manual 직접 고침
 *   legacy 환율이 없는 예전 지출(여행 기본 환율로 계산) · fallback 못 불러와서 여행 기본 환율 · loading 불러오는 중
 */
type RateKind = 'latest' | 'saved' | 'manual' | 'legacy' | 'fallback' | 'loading'

export interface ExpensePrefill {
  date?: string
  title?: string
  category?: Category
  planId?: string
}

interface Props {
  trip: Trip
  plans: Plan[]
  initial: Expense | null
  prefill?: ExpensePrefill // 일정의 장소에서 열었을 때 미리 채울 값
  onClose: () => void
}

/**
 * 지출 입력·수정. 가계부 탭에서도, 일정의 장소에서도 연다
 * 날짜·연결된 장소는 연 곳에서 정해지고(가계부의 Day 칸, 장소 카드) 창에서는 고르지 않는다
 */
export function ExpenseSheet({ trip, plans, initial, prefill, onClose }: Props) {
  const group = trip.members.length >= 2
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? 'JPY')
  const [category, setCategory] = useState<Category>(initial?.category ?? prefill?.category ?? 'food')
  const [title, setTitle] = useState(initial?.title ?? prefill?.title ?? '')
  const date = initial?.date || prefill?.date || defaultDay(trip.startDate, trip.endDate)
  const planId = initial?.planId ?? prefill?.planId ?? ''
  const memo = initial?.memo ?? '' // 메모 칸은 없앰 (예전에 적은 메모는 그대로 둠)
  const [method, setMethod] = useState<PayMethod>(initial?.method ?? 'card')
  const [payer, setPayer] = useState(initial?.payer ?? trip.members[0] ?? '')
  const [shared, setShared] = useState(initial?.shared ?? true)
  const [error, setError] = useState('')

  /* ── 환율: 지출을 적는 순간의 환율을 이 지출에 저장 (트리플처럼) ── */
  const tripRate = trip.krwPer100Jpy
  const savedRate = initial?.currency === 'JPY' && initial.krwPer100Jpy > 0 ? initial.krwPer100Jpy : 0
  const wantsLatest = !initial || initial.currency === 'KRW' // 새 지출(또는 원화였던 지출)은 최신 환율로
  const [rateInit] = useState(() => {
    if (!wantsLatest) return { text: String(savedRate || tripRate), date: savedRate ? (initial?.rateDate ?? '') : '', kind: (savedRate ? 'saved' : 'legacy') as RateKind }
    const c = cachedJpyRate() // 받아 둔 값이 있으면 바로 보여 주고, 아래에서 새로 확인
    return c ? { text: String(c.per100), date: c.date, kind: 'latest' as RateKind } : { text: '', date: '', kind: 'loading' as RateKind }
  })
  const [rate, setRate] = useState(rateInit.text)
  const [rateDate, setRateDate] = useState(rateInit.date)
  const [rateKind, setRateKind] = useState<RateKind>(rateInit.kind)
  const [rateOpen, setRateOpen] = useState(false)
  const rateTouched = useRef(false) // 사람이 환율을 고쳤으면 불러온 값으로 덮어쓰지 않음

  useEffect(() => {
    if (!wantsLatest) return
    let alive = true
    fetchJpyRate()
      .then((r) => {
        if (!alive || rateTouched.current) return
        setRate(String(r.per100))
        setRateDate(r.date)
        setRateKind('latest')
      })
      .catch(() => {
        if (!alive || rateTouched.current) return
        setRate((v) => v || String(tripRate))
        setRateKind((k) => (k === 'loading' ? 'fallback' : k))
      })
    return () => {
      alive = false
    }
  }, [])

  const rateNum = Number(rate) > 0 ? Number(rate) : tripRate
  // 저장할 때 이 지출에 환율을 고정하나 (예전 지출·못 불러온 경우는 여행 기본 환율을 따라감)
  const fixesRate = rateKind === 'latest' || rateKind === 'saved' || rateKind === 'manual'
  const rateLabel =
    rateKind === 'loading'
      ? '최신 환율 불러오는 중…'
      : rateKind === 'legacy'
        ? '여행 기본 환율'
        : rateKind === 'fallback'
          ? '여행 기본 환율 (최신 환율을 못 불러옴)'
          : rateKind === 'manual' || !rateDate
            ? '직접 넣은 환율'
            : `${fmtDay(rateDate)} 기준`

  const value = Number(amount.replace(/[^0-9.]/g, ''))
  const payers = payer && !trip.members.includes(payer) ? [...trip.members, payer] : trip.members
  const linked = plans.find((p) => p.id === planId)
  // 제목 아래: 어느 날(가계부 칸과 같은 이름) + 연결된 장소
  const when =
    date < trip.startDate ? `여행 준비 · ${fmtDay(date)}` : date > trip.endDate ? `여행 후 · ${fmtDay(date)}` : dayText(tripDays(trip.startDate, trip.endDate), date)
  const where = linked && initial ? `📍 ${linked.title}` : '' // 장소에서 열었을 땐 제목에 이미 장소 이름이 있음

  const save = () => {
    if (!(value > 0)) {
      setError('금액을 입력해 주세요')
      return
    }
    if (!date) {
      setError('날짜를 골라 주세요')
      return
    }
    if (currency === 'JPY' && rate.trim() && !(Number(rate) > 0)) {
      setRateOpen(true)
      setError('환율을 확인해 주세요 (100엔 = ?원)')
      return
    }
    const now = Date.now()
    const jpyFixed = currency === 'JPY' && fixesRate
    const expense: Expense = {
      id: initial?.id ?? newId(),
      date,
      title: title.trim(),
      amount: value,
      currency,
      krwPer100Jpy: jpyFixed ? rateNum : 0,
      rateDate: jpyFixed && rateKind !== 'manual' ? rateDate : '',
      category,
      method,
      payer: group ? payer : (trip.members[0] ?? ''),
      shared: group ? shared : true,
      memo,
      planId,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    }
    repo.saveItem(trip.id, 'expenses', expense).catch(reportError)
    onClose()
  }

  const remove = () => {
    if (!initial || !confirm('이 지출을 삭제할까요?')) return
    repo.deleteItem(trip.id, 'expenses', initial.id).catch(reportError)
    onClose()
  }

  return (
    <Sheet
      title={initial ? '지출 수정' : linked ? `${linked.title}에서 쓴 돈` : '지출 추가'}
      subtitle={<p className="truncate text-[13px] text-neutral-500">{[when, where].filter(Boolean).join(' · ')}</p>}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {initial && (
            <button type="button" onClick={remove} className={btnDanger}>
              삭제
            </button>
          )}
          <button type="button" onClick={save} className={btnPrimary}>
            저장
          </button>
        </div>
      }
    >
      <div>
        <div className="flex items-center gap-2">
          <div className="flex shrink-0 rounded-xl bg-neutral-100 p-1" role="group" aria-label="통화">
            {(['JPY', 'KRW'] as const).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={currency === c}
                onClick={() => setCurrency(c)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${currency === c ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-400'}`}
              >
                {c === 'JPY' ? '¥ 엔' : '₩ 원'}
              </button>
            ))}
          </div>
          <input
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value)
              setError('')
            }}
            inputMode="numeric"
            placeholder="0"
            aria-label="금액"
            className={`${inputCls} text-right text-2xl font-bold tabular-nums`}
            autoFocus={!initial}
          />
        </div>
        {currency === 'JPY' ? (
          <div className="mt-1.5 flex items-center justify-between gap-2">
            {/* 이 지출에 쓸 환율 (눌러서 고치기) */}
            <button type="button" onClick={() => setRateOpen((v) => !v)} className="flex min-w-0 items-center gap-1.5 py-1 text-left text-xs text-neutral-400">
              <span className="truncate">{rateKind === 'loading' ? rateLabel : `100엔 = ${rateNum.toLocaleString('ko-KR')}원 · ${rateLabel}`}</span>
              <span className="shrink-0 font-semibold" style={{ color: BLUE }}>
                {rateOpen ? '닫기' : '수정'}
              </span>
            </button>
            {value > 0 && <span className="shrink-0 text-[15px] font-semibold tabular-nums text-neutral-700">≈ {fmtKRW(toKRW(value, 'JPY', rateNum))}</span>}
          </div>
        ) : (
          <div className="mt-1.5 h-7" />
        )}
      </div>
      {currency === 'JPY' && rateOpen && (
        <RateField
          label="이 지출의 환율 (100엔 = ?원)"
          value={rate}
          onChange={setRate}
          onPicked={(r) => {
            rateTouched.current = true
            setRateDate(r?.date ?? '')
            setRateKind(r ? 'latest' : 'manual')
            setError('')
          }}
          hint="카드 명세서나 환전한 환율로 고치면 더 정확해요. 이 지출에만 적용돼요."
        />
      )}
      {error && <p className="-mt-3 text-sm text-red-600">{error}</p>}

      <Group label="카테고리">
        {CATEGORIES.map((c) => (
          <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
            {c.emoji} {c.label}
          </Chip>
        ))}
      </Group>

      <Field label="내용 (선택)">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 히츠마부시 2인, 입장권" className={inputCls} />
      </Field>

      <Group label="결제">
        {METHODS.map((m) => (
          <Chip key={m.id} active={method === m.id} onClick={() => setMethod(m.id)}>
            {m.label}
          </Chip>
        ))}
      </Group>

      {group && (
        <>
          <Group label="누가 냈나요">
            {payers.map((name) => (
              <Chip key={name} active={payer === name} onClick={() => setPayer(name)}>
                {name}
              </Chip>
            ))}
          </Group>
          <Group label="나누기">
            <Chip active={shared} onClick={() => setShared(true)}>
              일행 1/N
            </Chip>
            <Chip active={!shared} onClick={() => setShared(false)}>
              개인 지출
            </Chip>
          </Group>
        </>
      )}
    </Sheet>
  )
}
