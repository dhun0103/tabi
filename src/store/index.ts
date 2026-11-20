import type { FirebaseOptions } from 'firebase/app'
import { createCloudRepo } from './cloudRepo'
import { createLocalRepo } from './localRepo'
import type { TripRepo } from './repo'

export type { TripRepo } from './repo'

const env = import.meta.env

const firebaseConfig: FirebaseOptions | null =
  env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID
    ? {
        apiKey: env.VITE_FIREBASE_API_KEY,
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: env.VITE_FIREBASE_APP_ID,
      }
    : null

/** .env.local 에 Firebase 설정이 있으면 공유(cloud), 없으면 이 기기에만 저장(local) */
export const repo: TripRepo = firebaseConfig ? createCloudRepo(firebaseConfig) : createLocalRepo()
