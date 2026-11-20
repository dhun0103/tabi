import type { Expense, ListItem, ListName, Plan, Trip } from '../types'
import type { TripRepo } from './repo'

interface TripDoc {
  trip: Trip
  plans: Record<string, Plan>
  expenses: Record<string, Expense>
}

const keyOf = (tripId: string) => `tn:trip:${tripId}`

/** Firebase 설정이 없을 때 쓰는 "이 기기에만 저장" 저장소 */
export function createLocalRepo(): TripRepo {
  const listeners = new Map<string, Set<() => void>>()

  function read(tripId: string): TripDoc | null {
    try {
      const raw = localStorage.getItem(keyOf(tripId))
      return raw ? (JSON.parse(raw) as TripDoc) : null
    } catch {
      return null
    }
  }

  function write(tripId: string, doc: TripDoc) {
    localStorage.setItem(keyOf(tripId), JSON.stringify(doc))
    listeners.get(tripId)?.forEach((fn) => fn())
  }

  function mustRead(tripId: string): TripDoc {
    const doc = read(tripId)
    if (!doc) throw new Error('여행을 찾을 수 없어요')
    return doc
  }

  function subscribe(tripId: string, emit: () => void) {
    let active = true
    const fn = () => active && emit()
    let set = listeners.get(tripId)
    if (!set) {
      set = new Set()
      listeners.set(tripId, set)
    }
    set.add(fn)
    // 다른 탭에서 바뀐 것도 반영
    const onStorage = (e: StorageEvent) => e.key === keyOf(tripId) && fn()
    window.addEventListener('storage', onStorage)
    queueMicrotask(fn)
    return () => {
      active = false
      set.delete(fn)
      window.removeEventListener('storage', onStorage)
    }
  }

  return {
    mode: 'local',

    async createTrip(trip) {
      write(trip.id, { trip, plans: {}, expenses: {} })
    },

    async updateTrip(tripId, patch) {
      const doc = mustRead(tripId)
      write(tripId, { ...doc, trip: { ...doc.trip, ...patch, updatedAt: Date.now() } })
    },

    watchTrip(tripId, onData) {
      return subscribe(tripId, () => onData(read(tripId)?.trip ?? null))
    },

    watchList<N extends ListName>(tripId: string, name: N, onData: (items: ListItem<N>[]) => void) {
      return subscribe(tripId, () => {
        const doc = read(tripId)
        onData(doc ? (Object.values(doc[name]) as ListItem<N>[]) : [])
      })
    },

    async saveItem(tripId, name, item) {
      const doc = mustRead(tripId)
      write(tripId, { ...doc, [name]: { ...doc[name], [item.id]: item } })
    },

    async deleteItem(tripId, name, id) {
      const doc = mustRead(tripId)
      const next = { ...doc[name] }
      delete next[id]
      write(tripId, { ...doc, [name]: next })
    },
  }
}
