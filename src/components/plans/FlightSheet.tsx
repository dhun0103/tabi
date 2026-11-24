import { useState } from 'react'
import { orderForInsert } from '../../lib/order'
import { dayText, flightTitle, newId, suggestTime } from '../../lib/util'
import { repo } from '../../store'
import type { Flight, Plan, Trip } from '../../types'
import { TimePicker } from '../TimePicker'
import { Field, Sheet, btnDanger, btnPrimary, inputCls, reportError } from '../ui'

/** 공항 칸: 영문은 대문자로, 띄어쓰기 없이 (icn → ICN) */
const airportText = (s: string) => s.toUpperCase().replace(/\s+/g, '').slice(0, 8)

/** HH:mm에 몇 시간 더하기 (23시를 넘으면 23:xx) — 도착 시간 처음 값 */
function plusHours(time: string, h: number): string {
  if (!time) return '12:00'
  const [hh, mm] = time.split(':').map(Number)
  return `${String(Math.min(23, hh + h)).padStart(2, '0')}:${String(mm || 0).padStart(2, '0')}`
}

/**
 * 항공편 추가·수정 (일정에 파란 비행기 아이콘으로 나옴, NOL처럼 "ICN 09:10 - NGO 10:55 / 제주항공 · 7C1201")
 * 날짜는 지금 보고 있는 날(수정은 원래 날). 출발 시간 순서에 맞는 자리로 들어감
 */
export function FlightSheet(props: { trip: Trip; days: string[]; allPlans: Plan[]; initial: Plan | null; defaultDate: string; onClose: () => void }) {
  const { trip, days, allPlans, initial, defaultDate, onClose } = props
  const date = initial?.date ?? defaultDate
  const old = initial?.flight
  const [from, setFrom] = useState(old?.from ?? '')
  const [to, setTo] = useState(old?.to ?? '')
  const [depart, setDepart] = useState(initial?.time ?? '')
  const [arrive, setArrive] = useState(old?.arrive ?? '')
  const [airline, setAirline] = useState(old?.airline ?? '')
  const [number, setNumber] = useState(old?.number ?? '')
  const [error, setError] = useState('')

  const save = () => {
    if (!from || !to) return setError('출발·도착 공항을 적어 주세요 (예: ICN, NGO)')
    if (!depart) return setError('출발 시간을 골라 주세요')
    const now = Date.now()
    const sameDay = allPlans.filter((p) => p.id !== initial?.id && p.date === date)
    const flight: Flight = { from, to, arrive, airline: airline.trim(), number: number.trim().toUpperCase() }
    const plan: Plan = {
      id: initial?.id ?? newId(),
      type: 'flight',
      date,
      time: depart,
      order: !initial || initial.time !== depart ? orderForInsert(sameDay, depart) : initial.order,
      title: flightTitle(flight, depart), // 예전 버전 앱에서도 읽을 수 있게 제목으로도 남김
      place: '',
      placeId: '',
      mapUrl: '',
      memo: '',
      done: false,
      lat: null,
      lng: null,
      kind: '',
      area: '',
      flight,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    }
    repo.saveItem(trip.id, 'plans', plan).catch(reportError)
    onClose()
  }

  const remove = () => {
    if (!initial || !confirm('이 항공편을 지울까요?')) return
    repo.deleteItem(trip.id, 'plans', initial.id).catch(reportError)
    onClose()
  }

  const clearError = () => setError('')

  return (
    <Sheet
      title={initial ? '항공편 수정' : '항공편 추가'}
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
      {/* 왼쪽 출발, 오른쪽 도착 */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="출발 공항">
          <input
            value={from}
            onChange={(e) => {
              setFrom(airportText(e.target.value))
              clearError()
            }}
            placeholder="ICN"
            autoCapitalize="characters"
            autoComplete="off"
            className={`${inputCls} font-semibold tracking-wide`}
            autoFocus={!initial}
          />
        </Field>
        <Field label="도착 공항">
          <input
            value={to}
            onChange={(e) => {
              setTo(airportText(e.target.value))
              clearError()
            }}
            placeholder="NGO"
            autoCapitalize="characters"
            autoComplete="off"
            className={`${inputCls} font-semibold tracking-wide`}
          />
        </Field>
        <TimePicker
          label="출발 시간"
          value={depart}
          onChange={(t) => {
            setDepart(t)
            clearError()
          }}
          suggest={suggestTime(allPlans, date, initial?.id)}
        />
        <TimePicker label="도착 시간 (선택)" value={arrive} onChange={setArrive} suggest={plusHours(depart, 2)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="항공사 (선택)">
          <input value={airline} onChange={(e) => setAirline(e.target.value)} placeholder="예: 제주항공" className={inputCls} />
        </Field>
        <Field label="편명 (선택)">
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value.toUpperCase())}
            placeholder="예: 7C1201"
            autoCapitalize="characters"
            autoComplete="off"
            className={inputCls}
          />
        </Field>
      </div>
      {error && <p className="-mt-3 text-sm text-red-600">{error}</p>}
    </Sheet>
  )
}
