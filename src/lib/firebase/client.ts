'use client'

import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

/** Firebase web app from the public config (NEXT_PUBLIC_FIREBASE_*). These values are not secret. */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

export const firebaseReady = !!(config.apiKey && config.authDomain && config.projectId)

export const clientAuth = () => getAuth(getApps().length ? getApp() : initializeApp(config))
