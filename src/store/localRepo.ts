import type { Expense, ListItem, ListName, Photo, Plan, Trip } from '../types'
import type { TripRepo } from './repo'

interface TripDoc {
  trip: Trip
  plans: Record<string, Plan>
  expenses: Record<string, Expense>
}

const keyOf = (tripId: string) => `tn:trip:${tripId}`

/* ───────── 사진: localStorage(약 5MB)엔 안 들어가서 IndexedDB에 ───────── */

interface PhotoRecord extends Photo {
  key: string // `${tripId}/${id}`
  tripId: string
}

let photoDb: Promise<IDBDatabase> | null = null
function openPhotoDb(): Promise<IDBDatabase> {
  photoDb ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('tabi-photos', 1)
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore('photos', { keyPath: 'key' })
      store.createIndex('byPlan', ['tripId', 'planId'])
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('사진 저장소를 열지 못했어요'))
  })
  return photoDb
}

function done<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('사진 저장소 오류'))
  })
}

async function photoStore(mode: IDBTransactionMode) {
  return (await openPhotoDb()).transaction('photos', mode).objectStore('photos')
}

async function photosOf(tripId: string, planId: string): Promise<PhotoRecord[]> {
  const store = await photoStore('readonly')
  return done(store.index('byPlan').getAll([tripId, planId]) as IDBRequest<PhotoRecord[]>)
}

const toPhoto = (r: PhotoRecord): Photo => ({ id: r.id, planId: r.planId, data: r.data, width: r.width, height: r.height, createdAt: r.createdAt })

/** Firebase 설정이 없을 때 쓰는 "이 기기에만 저장" 저장소 */
export function createLocalRepo(): TripRepo {
  const listeners = new Map<string, Set<() => void>>()
  const photoListeners = new Set<() => void>() // 사진이 바뀌면 열려 있는 사진 목록을 다시 읽음
  const photosChanged = () => photoListeners.forEach((fn) => fn())

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

    watchPhotos(tripId, planId, onData, onError) {
      let active = true
      const load = () => {
        photosOf(tripId, planId)
          .then((list) => active && onData(list.map(toPhoto).sort((a, b) => a.createdAt - b.createdAt)))
          .catch((e: unknown) => active && onError(e instanceof Error ? e : new Error(String(e))))
      }
      photoListeners.add(load)
      load()
      return () => {
        active = false
        photoListeners.delete(load)
      }
    },

    async savePhoto(tripId, photo) {
      const store = await photoStore('readwrite')
      await done(store.put({ ...photo, key: `${tripId}/${photo.id}`, tripId } satisfies PhotoRecord))
      photosChanged()
    },

    async deletePhoto(tripId, id) {
      const store = await photoStore('readwrite')
      await done(store.delete(`${tripId}/${id}`))
      photosChanged()
    },

    async deletePhotosOf(tripId, planId) {
      const list = await photosOf(tripId, planId)
      const store = await photoStore('readwrite')
      await Promise.all(list.map((p) => done(store.delete(p.key))))
      photosChanged()
    },
  }
}
