/**
 * Create (or re-invite) an admin who signs in with email + password.
 *
 *   npm run admin:create -- someone@company.com "Full Name"
 *   NO_LINK=1 npm run admin:create -- someone@company.com "Full Name"   (account already has a password)
 *
 * Creates the Firebase account and the `users` row, linked together, then prints a one-time link where the
 * person sets their password. Share it with them privately. Run it again to get a fresh link.
 */
import { getPayload } from 'payload'

import config from '../payload.config'
import { firebaseAuth } from '../lib/firebase/admin'

// `payload run` drops unknown --flags, so options come from the environment.
const noLink = process.env.NO_LINK === '1'
const [emailArg, ...nameParts] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const email = emailArg?.trim().toLowerCase()
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: npm run admin:create -- someone@company.com "Full Name"')
  process.exit(1)
}
const name = nameParts.join(' ').trim() || email.split('@')[0]

const auth = firebaseAuth()
const account = await auth.getUserByEmail(email).catch(() => null)
const fbUser = account ?? (await auth.createUser({ email, displayName: name, emailVerified: false }))

const payload = await getPayload({ config })
const existing = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, overrideAccess: true })
if (existing.docs[0]) {
  await payload.update({
    collection: 'users',
    id: existing.docs[0].id,
    data: { firebaseUid: fbUser.uid, role: 'admin', disabled: false },
    overrideAccess: true,
  })
} else {
  await payload.create({ collection: 'users', data: { name, email, role: 'admin', firebaseUid: fbUser.uid }, overrideAccess: true })
}

console.log(`\n✓ ${name} <${email}> is an admin and can sign in with email + password.`)
if (!noLink) {
  // Setting the password through this link also proves they own the address.
  const link = await auth.generatePasswordResetLink(email)
  console.log(`\nSet-password link (share privately, expires in about an hour):\n${link}\n`)
}
process.exit(0)
