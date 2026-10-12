import { applicationDefault, cert, getApp, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getAppCheck } from 'firebase-admin/app-check'
import { getStorage } from 'firebase-admin/storage'

/**
 * Firebase Admin — used for sign-in (verifying Firebase tokens / session cookies, managing app logins) and file
 * storage. Credentials:
 *  - on Firebase App Hosting (Google Cloud), the backend's own service account (no key needed);
 *  - elsewhere (local development), three .env values copied out of a service-account key:
 *    FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.
 */
const projectId = () => process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT
const hasKey = () => !!(process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)
/** Running on Google Cloud (App Hosting / Cloud Run sets K_SERVICE; App Hosting also sets FIREBASE_CONFIG). */
const onGoogleCloud = () => !!(process.env.K_SERVICE || process.env.FIREBASE_CONFIG)

function app(): App {
  if (getApps().length) return getApp()
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  if (hasKey()) {
    // .env files keep the key on one line with literal "\n"; turn them back into line breaks. A value pasted into
    // a console (App Hosting → Environment) keeps the quotes .env files use, which makes the key unreadable: drop them.
    const privateKey = process.env.FIREBASE_PRIVATE_KEY!.trim().replace(/^(['"])([\s\S]*)\1$/, '$2').replace(/\\n/g, '\n')
    return initializeApp({ credential: cert({ projectId: projectId(), clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey }), storageBucket })
  }
  if (onGoogleCloud()) return initializeApp({ credential: applicationDefault(), projectId: projectId(), storageBucket })
  throw new Error('Firebase is not configured: set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY')
}

export const firebaseAuth = () => getAuth(app())
export const bucket = () => getStorage(app()).bucket()
export const appCheck = () => getAppCheck(app())

export const isFirebaseConfigured = () => !!projectId() && (hasKey() || onGoogleCloud())

/** Name of the HttpOnly cookie holding the Firebase session (the only cookie Firebase Hosting forwards). */
export const SESSION_COOKIE = '__session'
/** How long an admin stays signed in. */
export const SESSION_DAYS = 5
