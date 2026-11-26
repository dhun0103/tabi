import { initializeApp, type FirebaseOptions } from 'firebase/app'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore'
import { myKey } from '../lib/session'
import type { Expense, ListItem, ListName, Photo, Trip } from '../types'
import type { TripRepo } from './repo'

/**
 * Firestore 저장소
 *   trips/{tripId}              여행 정보
 *   trips/{tripId}/plans/{id}   일정
 *   trips/{tripId}/expenses/{id} 지출
 *   trips/{tripId}/photos/{id}  장소 사진 (줄인 JPEG, 장소별로만 받아 옴)
 *   trips/{tripId}/personal/{이 폰 열쇠}/expenses/{id}  내 지출 (이 폰에만, 열쇠를 아는 폰만 읽음)
 *
 * persistentLocalCache: 폰 안(IndexedDB)에 사본을 둬서
 * 지하철 등에서 끊겨도 보고 입력할 수 있고, 연결되면 자동 동기화된다.
 */
export function createCloudRepo(config: FirebaseOptions): TripRepo {
  const app = initializeApp(config)
  let db: Firestore
  try {
    db = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  } catch {
    db = initializeFirestore(app, { ignoreUndefinedProperties: true })
  }

  return {
    mode: 'cloud',

    createTrip(trip) {
      return setDoc(doc(db, 'trips', trip.id), trip)
    },

    updateTrip(tripId, patch) {
      return updateDoc(doc(db, 'trips', tripId), { ...patch, updatedAt: Date.now() })
    },

    watchTrip(tripId, onData, onError) {
      return onSnapshot(
        doc(db, 'trips', tripId),
        (snap) => {
          // 처음 여는 기기에서 캐시에 없을 뿐일 수 있으니 서버 응답을 기다린다
          if (!snap.exists() && snap.metadata.fromCache) return
          onData(snap.exists() ? (snap.data() as Trip) : null)
        },
        onError,
      )
    },

    watchList<N extends ListName>(
      tripId: string,
      name: N,
      onData: (items: ListItem<N>[]) => void,
      onError: (err: Error) => void,
    ) {
      return onSnapshot(
        collection(db, 'trips', tripId, name),
        (snap) => onData(snap.docs.map((d) => d.data() as ListItem<N>)),
        onError,
      )
    },

    saveItem(tripId, name, item) {
      return setDoc(doc(db, 'trips', tripId, name, item.id), item)
    },

    // updateDoc: 준 칸만 바꾸고, 문서가 없으면(일행이 지움) not-found로 실패 → 되살리지 않음
    patchItem(tripId, name, id, changes) {
      return updateDoc(doc(db, 'trips', tripId, name, id), changes as DocumentData)
    },

    deleteItem(tripId, name, id) {
      return deleteDoc(doc(db, 'trips', tripId, name, id))
    },

    watchMine(tripId, onData, onError) {
      return onSnapshot(
        collection(db, 'trips', tripId, 'personal', myKey(), 'expenses'),
        (snap) => onData(snap.docs.map((d) => d.data() as Expense)),
        onError,
      )
    },

    saveMine(tripId, item) {
      return setDoc(doc(db, 'trips', tripId, 'personal', myKey(), 'expenses', item.id), item)
    },

    patchMine(tripId, id, changes) {
      return updateDoc(doc(db, 'trips', tripId, 'personal', myKey(), 'expenses', id), changes as DocumentData)
    },

    deleteMine(tripId, id) {
      return deleteDoc(doc(db, 'trips', tripId, 'personal', myKey(), 'expenses', id))
    },

    watchPhotos(tripId, planId, onData, onError) {
      return onSnapshot(
        query(collection(db, 'trips', tripId, 'photos'), where('planId', '==', planId)),
        (snap) => onData(snap.docs.map((d) => d.data() as Photo).sort((a, b) => a.createdAt - b.createdAt)),
        onError,
      )
    },

    savePhoto(tripId, photo) {
      return setDoc(doc(db, 'trips', tripId, 'photos', photo.id), photo)
    },

    deletePhoto(tripId, id) {
      return deleteDoc(doc(db, 'trips', tripId, 'photos', id))
    },

    async deletePhotosOf(tripId, planId) {
      const snap = await getDocs(query(collection(db, 'trips', tripId, 'photos'), where('planId', '==', planId)))
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
    },
  }
}
