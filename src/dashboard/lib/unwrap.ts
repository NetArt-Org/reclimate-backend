import type { ActionResult } from '../server/result'

/** The data of a server action result, or throw its (user-facing) error message. */
export function unwrap<T>(r: ActionResult<T>): T {
  if (!r.ok) throw new Error(r.error)
  return r.data
}
