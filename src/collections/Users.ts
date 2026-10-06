import type { AuthStrategy, CollectionConfig } from 'payload'

import { isAdmin } from './shared'

/** Name of the HttpOnly cookie holding the Firebase session (see src/lib/firebase/admin.ts). */
const SESSION_COOKIE = '__session'

const cookieValue = (headers: Headers, name: string) =>
  headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1)

/**
 * Sign-in is Firebase (Google or email + password). /admin/session turns a Firebase ID token into a session cookie;
 * this strategy verifies that cookie on every request and finds the matching user in Neon,
 * which holds the role. A Firebase account without a user row here gets no access.
 */
const firebaseStrategy: AuthStrategy = {
  name: 'firebase',
  authenticate: async ({ headers, payload }) => {
    const cookie = cookieValue(headers, SESSION_COOKIE)
    if (!cookie) return { user: null }
    try {
      const { firebaseAuth, isFirebaseConfigured } = await import('../lib/firebase/admin')
      if (!isFirebaseConfigured()) return { user: null }
      const decoded = await firebaseAuth().verifySessionCookie(decodeURIComponent(cookie), true)
      // Only the Firebase account linked to the row signs in — never just a matching email (/admin/session links it).
      const found = await payload.find({
        collection: 'users',
        where: { firebaseUid: { equals: decoded.uid } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const user = found.docs[0]
      if (!user || user.disabled) return { user: null }
      // Google sign-ins only count while the person allows them (profile setting).
      if (decoded.firebase?.sign_in_provider === 'google.com' && !user.googleSignIn) return { user: null }
      return { user: { ...user, collection: 'users', _strategy: 'firebase' } }
    } catch {
      return { user: null }
    }
  },
}

/** Admin accounts. Field people (operators, farmers) are in `people`. */
export const Users: CollectionConfig = {
  slug: 'users',
  auth: { disableLocalStrategy: true, strategies: [firebaseStrategy] },
  access: {
    read: ({ req }) => (req.user?.role === 'admin' ? true : req.user ? { id: { equals: req.user.id } } : false),
    create: isAdmin,
    update: ({ req }) => (req.user?.role === 'admin' ? true : req.user ? { id: { equals: req.user.id } } : false),
    delete: isAdmin,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    // The sign-in identity: only an admin changes it (Settings → Admin access).
    { name: 'email', type: 'email', required: true, unique: true, index: true, access: { update: ({ req }) => req.user?.role === 'admin' } },
    /** Filled in on first sign-in. */
    { name: 'firebaseUid', type: 'text', unique: true, index: true, access: { update: () => false } },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'admin',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Viewer', value: 'viewer' },
      ],
      access: { update: ({ req }) => req.user?.role === 'admin' },
    },
    /** Lets this person sign in with Google; otherwise only email + password. */
    { name: 'googleSignIn', type: 'checkbox', defaultValue: false },
    { name: 'phone', type: 'text' },
    { name: 'photoUrl', type: 'text' },
    { name: 'disabled', type: 'checkbox', defaultValue: false, access: { update: ({ req }) => req.user?.role === 'admin' } },
    { name: 'lastSignInAt', type: 'date' },
  ],
}
