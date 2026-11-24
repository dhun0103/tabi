import type { ListItem, ListName, Photo, Trip } from '../types'

export type Unsubscribe = () => void

/**
 * 저장소 인터페이스.
 * - local: 이 기기(localStorage, 사진은 IndexedDB)에만 저장
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
  /**
   * 이미 있는 항목의 몇 칸만 고침 (수정 저장·순서 바꾸기)
   * - 안 고친 칸은 건드리지 않아서, 그사이 일행이 고친 값이 그대로 남음
   * - 일행이 먼저 지운 항목이면 실패(code 'not-found') → 지운 항목을 되살리지 않음
   */
  patchItem<N extends ListName>(tripId: string, name: N, id: string, changes: Partial<ListItem<N>>): Promise<void>
  deleteItem(tripId: string, name: ListName, id: string): Promise<void>

  /** 장소 하나의 사진만 (사진은 커서 여행 전체를 한꺼번에 받지 않음) */
  watchPhotos(tripId: string, planId: string, onData: (photos: Photo[]) => void, onError: (err: Error) => void): Unsubscribe
  savePhoto(tripId: string, photo: Photo): Promise<void>
  deletePhoto(tripId: string, id: string): Promise<void>
  /** 장소를 지울 때 그 장소 사진도 같이 */
  deletePhotosOf(tripId: string, planId: string): Promise<void>
}
