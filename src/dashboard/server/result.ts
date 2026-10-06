/**
 * Server actions return an ActionResult instead of throwing: Next.js production builds replace the
 * message of an Error thrown inside a server action with a generic one, so validation messages
 * would never reach the user. Throw a UserError for messages meant for the user; anything else is
 * logged on the server and reported generically.
 *
 * Plain module (not 'use server') so both server actions and client code can import it.
 */

import { unstable_rethrow } from 'next/navigation'

/** An error whose message is safe and meant to be shown to the user. */
export class UserError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserError'
  }
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

/** Largest file the admin accepts (keep in step with storage.ts MAX_FILE). */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
export const MAX_UPLOAD_LABEL = '4 MB'

const SIGNED_OUT = 'Not signed in as an admin'

/** Run an action body, turning its outcome into an ActionResult. */
export function guard<A extends unknown[], T>(fn: (...a: A) => Promise<T>): (...a: A) => Promise<ActionResult<T>> {
  return async (...a: A) => {
    try {
      return { ok: true, data: await fn(...a) }
    } catch (err) {
      // Next.js control flow (redirect, notFound, dynamic rendering) must pass through untouched.
      unstable_rethrow(err)
      if (err instanceof UserError) return { ok: false, error: err.message }
      if (err instanceof Error && err.message === SIGNED_OUT) return { ok: false, error: 'Your session has ended. Sign in again.' }
      console.error('[server action]', err)
      return { ok: false, error: 'Something went wrong. Please try again.' }
    }
  }
}
