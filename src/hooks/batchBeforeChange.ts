import { Forbidden, type CollectionBeforeChangeHook } from 'payload'

import type { Batch } from '@/payload-types'
import { roleOf, siteOf } from '../access'

/** Status changes a worker may make themselves; everything else is a supervisor's call. */
const WORKER_MOVES: Record<string, string[]> = {
  progress: ['waiting'],
  rejected: ['waiting'],
  // Day 4 can only be finished on a batch a supervisor has approved.
  approved: ['done'],
}

const round = (n: number, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits

/**
 * Keeps a batch consistent on every save:
 *  - workers own the batches they create and cannot approve/reject them
 *  - derived numbers (weight in kg, credits) are computed here, not trusted from the client
 *  - a supervisor's decision is stamped with who and when
 */
export const batchBeforeChange: CollectionBeforeChangeHook<Batch> = async ({
  data,
  req,
  operation,
  originalDoc,
}) => {
  const role = roleOf(req)
  const prevStatus = originalDoc?.status
  const statusChanged = operation === 'create' ? !!data.status : (data.status ?? prevStatus) !== prevStatus
  const nextStatus = data.status ?? prevStatus

  if (req.user && operation === 'create' && role !== 'admin') {
    if (role === 'worker') data.worker = req.user.id
    data.site = siteOf(req) as Batch['site']
  }

  if (req.user && role === 'worker' && statusChanged) {
    if (operation === 'create') {
      if (nextStatus !== 'progress' && nextStatus !== 'waiting') throw new Forbidden(req.t)
    } else if (!WORKER_MOVES[prevStatus ?? 'progress']?.includes(nextStatus ?? '')) {
      // The phone may be out of date (it works offline): keep the server's status
      // rather than let a stale save undo a supervisor's decision.
      data.status = prevStatus
    }
  }

  const decided = data.status === 'approved' || data.status === 'rejected' || data.status === 'done'
  if (req.user && role !== 'worker' && statusChanged && decided) {
    // A fresh decision always carries the current reviewer and time.
    data.review = { ...data.review, reviewedBy: req.user.id, reviewedAt: new Date().toISOString() }
    if (data.status !== 'rejected') {
      data.review.rejectReason = null
      data.review.rejectNote = null
    }
  }

  const quantity = data.collect?.quantity ?? originalDoc?.collect?.quantity
  if (quantity != null) {
    const unit = data.collect?.unit ?? originalDoc?.collect?.unit ?? 'kg'
    data.collect = { ...data.collect, weightKg: Math.round(quantity * (unit === 'ton' ? 1000 : 1)) }
  }

  const litres = data.burn?.litres ?? originalDoc?.burn?.litres
  if (litres != null) {
    const settings = await req.payload.findGlobal({ slug: 'settings', req })
    data.credits = round(litres * (settings.creditFactor ?? 0.1))
  }

  return data
}
