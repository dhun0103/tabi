import { useState } from 'react'
import { byOrder } from '../../lib/order'
import { CATEGORIES, METHODS, defaultDay, fmtKRW, newId, toKRW } from '../../lib/util'
import { repo } from '../../store'
import type { Category, Currency, Expense, PayMethod, Plan, Trip } from '../../types'
import { Chip, Field, Group, Sheet, btnDanger, btnPrimary, inputCls, reportError } from '../ui'

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

/** 지출 입력·수정. 가계부 탭에서도, 일정의 장소에서도 연다 */
export function ExpenseSheet({ trip, plans, initial, prefill, onClose }: Props) {
  const group = trip.members.length >= 2
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? 'JPY')
  const [category, setCategory] = useState<Category>(initial?.category ?? prefill?.category ?? 'food')
  const [title, setTitle] = useState(initial?.title ?? prefill?.title ?? '')
  const [date, setDate] = useState(initial?.date || prefill?.date || defaultDay(trip.startDate, trip.endDate))
  const [planId, setPlanId] = useState(initial?.planId ?? prefill?.planId ?? '')
  const [method, setMethod] = useState<PayMethod>(initial?.method ?? 'card')
  const [payer, setPayer] = useState(initial?.payer ?? trip.members[0] ?? '')
  const [shared, setShared] = useState(initial?.shared ?? true)
  const [memo, setMemo] = useState(initial?.memo ?? '')
  const [error, setError] = useState('')

  const value = Number(amount.replace(/[^0-9.]/g, ''))
  const payers = payer && !trip.members.includes(payer) ? [...trip.members, payer] : trip.members
  const linked = plans.find((p) => p.id === planId)
  // 고른 날짜의 장소들 (+ 이미 연결된 장소가 다른 날이면 그것도)
  const placeOptions = plans.filter((p) => p.type === 'place' && (p.date === date || p.id === planId)).sort(byOrder)

  const save = () => {
    if (!(value > 0)) {
      setError('금액을 입력해 주세요')
      return
    }
    if (!date) {
      setError('날짜를 골라 주세요')
      return
    }
    const now = Date.now()
    const expense: Expense = {
      id: initial?.id ?? newId(),
      date,
      title: title.trim(),
      amount: value,
      currency,
      category,
      method,
      payer: group ? payer : (trip.members[0] ?? ''),
      shared: group ? shared : true,
      memo: memo.trim(),
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
        <p className="mt-1 h-4 text-right text-xs text-neutral-400">
          {currency === 'JPY' && value > 0 ? fmtKRW(toKRW(value, 'JPY', trip.krwPer100Jpy)) : ''}
        </p>
      </div>
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

      <div className="grid grid-cols-2 gap-3">
        <Field label="날짜">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Field>
        <Group label="결제">
          {METHODS.map((m) => (
            <Chip key={m.id} active={method === m.id} onClick={() => setMethod(m.id)}>
              {m.label}
            </Chip>
          ))}
        </Group>
      </div>

      <Field label="일정 장소 (선택)" hint="장소에 연결하면 일정에서 그 장소에 쓴 돈이 같이 보여요">
        <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={inputCls}>
          <option value="">연결 안 함</option>
          {placeOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.time ? `${p.time} · ` : ''}
              {p.title}
            </option>
          ))}
        </select>
      </Field>

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

      <Field label="메모 (선택)">
        <input value={memo} onChange={(e) => setMemo(e.target.value)} className={inputCls} />
      </Field>
    </Sheet>
  )
}
