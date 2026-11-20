import { useState } from 'react'
import {
  CATEGORIES,
  METHODS,
  categoryOf,
  defaultDay,
  fmtDay,
  fmtJPY,
  fmtKRW,
  fmtMoney,
  newId,
  settle,
  toKRW,
} from '../lib/util'
import { repo } from '../store'
import type { Category, Currency, Expense, PayMethod, Trip } from '../types'
import { Band, Chip, Empty, Fab, Field, Group, Sheet, btnDanger, btnPrimary, inputCls, reportError, sectionTitle } from './ui'

const BAR = '#2a78d6' // 카테고리 막대: 한 가지 색 (이름표가 카테고리를 구분)

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export function ExpensesTab({ trip, expenses }: { trip: Trip; expenses: Expense[] }) {
  const [editing, setEditing] = useState<Expense | 'new' | null>(null)
  const rate = trip.krwPer100Jpy
  const krw = (e: Expense) => toKRW(e.amount, e.currency, rate)

  const total = sum(expenses.map(krw))
  const jpyOnly = sum(expenses.filter((e) => e.currency === 'JPY').map((e) => e.amount))
  const krwOnly = sum(expenses.filter((e) => e.currency === 'KRW').map((e) => e.amount))

  const byCategory = CATEGORIES.map((c) => ({ ...c, value: sum(expenses.filter((e) => e.category === c.id).map(krw)) }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value)
  const max = byCategory[0]?.value ?? 0

  const dates = [...new Set(expenses.map((e) => e.date))].sort().reverse()
  const groups = dates.map((d) => ({
    date: d,
    items: expenses.filter((e) => e.date === d).sort((a, b) => b.createdAt - a.createdAt),
  }))

  const group = trip.members.length >= 2
  const settlement = group ? settle(trip.members, expenses, rate) : null

  return (
    <>
      <section className="px-5 pb-6 pt-5">
        <p className="text-[13px] text-neutral-500">총 지출</p>
        <p className="mt-1 text-5xl font-bold tracking-tight">{fmtKRW(total)}</p>
        <p className="mt-2 text-[13px] text-neutral-500">
          엔화 {fmtJPY(jpyOnly)}
          {krwOnly > 0 && ` · 원화 ${fmtKRW(krwOnly)}`}
          <span className="text-neutral-300"> · </span>
          <span className="text-neutral-400">100엔 = {rate.toLocaleString('ko-KR')}원</span>
        </p>
      </section>

      {byCategory.length > 0 && (
        <>
          <Band />
          <section className="px-5 py-5">
            <h3 className={sectionTitle}>카테고리별</h3>
            <ul className="mt-4 space-y-3.5">
              {byCategory.map((c) => (
                <li key={c.id}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-neutral-700">
                      {c.emoji} {c.label}
                    </span>
                    <span className="tabular-nums text-neutral-900">
                      {fmtKRW(c.value)}
                      <span className="ml-1.5 text-neutral-400">{Math.round((c.value / total) * 100)}%</span>
                    </span>
                  </div>
                  <div
                    className="mt-1.5 h-2 rounded-r-[4px]"
                    style={{ width: `max(2px, ${(c.value / max) * 100}%)`, background: BAR }}
                    aria-hidden="true"
                  />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {settlement && settlement.total > 0 && (
        <>
          <Band />
          <section className="px-5 py-5">
            <h3 className={sectionTitle}>정산</h3>
            <p className="mt-1 text-xs text-neutral-400">
              공동 경비 {fmtKRW(settlement.total)} · 1인당 {fmtKRW(settlement.share)}
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {settlement.people.map((p) => (
                <li key={p.name} className="flex justify-between gap-2">
                  <span className="text-neutral-700">
                    {p.name} <span className="text-neutral-400">· 낸 돈 {fmtKRW(p.paid)}</span>
                  </span>
                  <span className="font-medium tabular-nums">
                    {Math.abs(p.balance) < 1 ? '정산 완료' : p.balance > 0 ? `받을 돈 ${fmtKRW(p.balance)}` : `낼 돈 ${fmtKRW(-p.balance)}`}
                  </span>
                </li>
              ))}
            </ul>
            {settlement.transfers.length > 0 && (
              <ul className="mt-3 space-y-1.5 rounded-xl bg-neutral-50 px-4 py-3 text-sm">
                {settlement.transfers.map((t, i) => (
                  <li key={i} className="flex justify-between">
                    <span className="text-neutral-700">
                      {t.from} → {t.to}
                    </span>
                    <span className="font-semibold tabular-nums">{fmtKRW(t.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <Band />
      {groups.length === 0 ? (
        <Empty icon="💴" title="아직 지출이 없어요" desc="오른쪽 아래 + 버튼으로 추가하세요" />
      ) : (
        groups.map((g) => (
          <section key={g.date} className="px-5 pt-5">
            <div className="flex justify-between text-[13px]">
              <span className="font-semibold text-neutral-900">{fmtDay(g.date)}</span>
              <span className="tabular-nums text-neutral-400">{fmtKRW(sum(g.items.map(krw)))}</span>
            </div>
            <ul className="mt-1 divide-y divide-neutral-100">
              {g.items.map((e) => {
                const c = categoryOf(e.category)
                const sub = [c.label, METHODS.find((m) => m.id === e.method)?.label, group ? e.payer : '', group && !e.shared ? '개인' : '']
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <li key={e.id}>
                    <button type="button" onClick={() => setEditing(e)} className="flex w-full items-center gap-3 py-3.5 text-left active:bg-neutral-50">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xl" aria-hidden="true">
                        {c.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">{e.title || c.label}</span>
                        <span className="block text-xs text-neutral-400">{sub}</span>
                      </span>
                      <span className="text-right">
                        <span className="block text-[15px] font-semibold tabular-nums">{fmtMoney(e.amount, e.currency)}</span>
                        {e.currency === 'JPY' && <span className="block text-xs tabular-nums text-neutral-400">{fmtKRW(krw(e))}</span>}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}

      <Fab label="지출 추가" onClick={() => setEditing('new')} />
      {editing && <ExpenseSheet trip={trip} initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function ExpenseSheet(props: { trip: Trip; initial: Expense | null; onClose: () => void }) {
  const { trip, initial, onClose } = props
  const group = trip.members.length >= 2
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? 'JPY')
  const [category, setCategory] = useState<Category>(initial?.category ?? 'food')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [date, setDate] = useState(initial?.date ?? defaultDay(trip.startDate, trip.endDate))
  const [method, setMethod] = useState<PayMethod>(initial?.method ?? 'card')
  const [payer, setPayer] = useState(initial?.payer ?? trip.members[0] ?? '')
  const [shared, setShared] = useState(initial?.shared ?? true)
  const [memo, setMemo] = useState(initial?.memo ?? '')
  const [error, setError] = useState('')

  const value = Number(amount.replace(/[^0-9.]/g, ''))
  const payers = payer && !trip.members.includes(payer) ? [...trip.members, payer] : trip.members

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
      title={initial ? '지출 수정' : '지출 추가'}
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
          {currency === 'JPY' && value > 0 ? `${fmtKRW(toKRW(value, 'JPY', trip.krwPer100Jpy))}` : ''}
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
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 야바톤 미소카츠" className={inputCls} />
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
