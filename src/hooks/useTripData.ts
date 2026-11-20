import { useEffect, useState } from 'react'
import { normalizeExpense, normalizePlan } from '../lib/backup'
import { repo } from '../store'
import type { Expense, Plan, Trip } from '../types'

// 저장된 데이터가 예전 형식이어도 화면에서는 항상 같은 모양으로 쓴다
const cleanPlans = (xs: Plan[]) => xs.map(normalizePlan).filter((p): p is Plan => p !== null)
const cleanExpenses = (xs: Expense[]) => xs.map(normalizeExpense).filter((e): e is Expense => e !== null)

/** 여행 정보 + 일정 + 지출을 실시간으로 구독 (일행이 바꾸면 바로 반영) */
export function useTripData(tripId: string | null) {
  const [trip, setTrip] = useState<Trip | null | undefined>(undefined) // undefined = 불러오는 중
  const [plans, setPlans] = useState<Plan[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!tripId) return
    setTrip(undefined)
    setPlans([])
    setExpenses([])
    setError(null)
    const onError = (e: Error) => setError(e.message)
    const offs = [
      repo.watchTrip(tripId, setTrip, onError),
      repo.watchList(tripId, 'plans', (xs) => setPlans(cleanPlans(xs)), onError),
      repo.watchList(tripId, 'expenses', (xs) => setExpenses(cleanExpenses(xs)), onError),
    ]
    return () => offs.forEach((off) => off())
  }, [tripId])

  return { trip, plans, expenses, error }
}

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}
