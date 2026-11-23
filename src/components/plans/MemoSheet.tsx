import { useState } from 'react'
import { orderForInsert } from '../../lib/order'
import { dayText, newId } from '../../lib/util'
import { repo } from '../../store'
import type { Plan, Trip } from '../../types'
import { Field, Sheet, btnDanger, btnPrimary, inputCls, reportError } from '../ui'

/** 일정 사이에 끼워 넣는 메모 (예: "여기서 지하철 1일권 사기") */
export function MemoSheet(props: { trip: Trip; days: string[]; allPlans: Plan[]; initial: Plan | null; defaultDate: string; onClose: () => void }) {
  const { trip, days, allPlans, initial, defaultDate, onClose } = props
  // 날짜는 고르지 않음: 추가는 지금 보고 있는 날, 수정은 원래 날 그대로
  const date = initial?.date ?? defaultDate
  const [text, setText] = useState(initial?.title ?? '')
  const [error, setError] = useState('')

  const save = () => {
    if (!text.trim()) {
      setError('메모 내용을 적어 주세요')
      return
    }
    const now = Date.now()
    const sameDay = allPlans.filter((p) => p.id !== initial?.id && p.date === date)
    const plan: Plan = {
      id: initial?.id ?? newId(),
      type: 'memo',
      date,
      time: '',
      order: !initial || initial.date !== date ? orderForInsert(sameDay, '') : initial.order,
      title: text.trim(),
      place: '',
      placeId: '',
      mapUrl: '',
      memo: '',
      done: false,
      lat: null,
      lng: null,
      kind: '',
      area: '',
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    }
    repo.saveItem(trip.id, 'plans', plan).catch(reportError)
    onClose()
  }

  const remove = () => {
    if (!initial || !confirm('이 메모를 지울까요?')) return
    repo.deleteItem(trip.id, 'plans', initial.id).catch(reportError)
    onClose()
  }

  return (
    <Sheet
      title={initial ? '메모 수정' : '메모 추가'}
      // 날짜 칸이 없으니 어느 날인지 제목 아래에 표시
      subtitle={<p className="text-[13px] text-neutral-500">{dayText(days, date)}</p>}
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
      <Field label="메모" hint="편집에서 화살표로 원하는 자리로 옮길 수 있어요">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setError('')
          }}
          rows={4}
          placeholder="예: 여기서 지하철 1일권 사기"
          className={inputCls}
          autoFocus={!initial}
        />
      </Field>
      {error && <p className="-mt-3 text-sm text-red-600">{error}</p>}
    </Sheet>
  )
}
