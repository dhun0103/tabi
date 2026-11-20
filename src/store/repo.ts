import type { ListItem, ListName, Trip } from '../types'

export type Unsubscribe = () => void

/**
 * 저장소 인터페이스.
 * - local: 이 기기(localStorage)에만 저장
 * - cloud: Firebase Firestore (일행과 공유, 오프라인 입력 후 자동 동기화)
 *
 * 쓰기 함수는 cloud 모드에서 오프라인이면 서버 응답까지 끝나지 않으므로
 * 화면에서는 await 하지 말고 바로 닫는다 (화면에는 즉시 반영됨).
 */
export interface TripRepo {
  readonly mode: 'local' | 'cloud'
  createTrip(trip: Trip): Promise<void>
  updateTrip(tripId: string, patch: Partial<Omit<Trip, 'id'>>): Promise<void>
  watchTrip(tripId: string, onData: (trip: Trip | null) => void, onError: (err: Error) => void): Unsubscribe
  watchList<N extends ListName>(
    tripId: string,
    name: N,
    onData: (items: ListItem<N>[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe
  saveItem<N extends ListName>(tripId: string, name: N, item: ListItem<N>): Promise<void>
  deleteItem(tripId: string, name: ListName, id: string): Promise<void>
}
