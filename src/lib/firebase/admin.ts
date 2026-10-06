import { cert, getApp, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getStorage } from 'firebase-admin/storage'

/**
 * Firebase Admin, configured from three .env values copied out of the service-account key
 * (no JSON file): FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.
 * Used for sign-in (verifying Firebase tokens / session cookies) and file storage.
 */
function app(): App {
  if (getApps().length) return getApp()
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  // .env files keep the key on one line with literal "\n"; turn them back into line breaks.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase is not configured: set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY')
  }
  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  })
}

export const firebaseAuth = () => getAuth(app())
export const bucket = () => getStorage(app()).bucket()

export const isFirebaseConfigured = () =>
  !!(process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY && (process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID))

/** Name of the HttpOnly cookie holding the Firebase session. */
export const SESSION_COOKIE = '__session'
/** How long an admin stays signed in. */
export const SESSION_DAYS = 5
