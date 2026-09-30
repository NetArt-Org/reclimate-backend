import { Forbidden, type CollectionBeforeChangeHook } from 'payload'

import type { Batch } from '@/payload-types'
import { roleOf, siteOf } from '../access'

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
  const nextStatus = data.status ?? prevStatus
  const statusChanged = operation === 'create' ? !!data.status : nextStatus !== prevStatus

  if (req.user && operation === 'create' && role !== 'admin') {
    if (role === 'worker') data.worker = req.user.id
    data.site = siteOf(req) as Batch['site']
  }

  if (req.user && role === 'worker' && statusChanged) {
    if (nextStatus === 'approved' || nextStatus === 'rejected') throw new Forbidden(req.t)
    // Day 4 can only be finished on a batch a supervisor has approved.
    if (nextStatus === 'done' && prevStatus !== 'approved') throw new Forbidden(req.t)
  }

  if (req.user && role !== 'worker' && statusChanged && (nextStatus === 'approved' || nextStatus === 'rejected')) {
    data.review = {
      ...data.review,
      reviewedBy: data.review?.reviewedBy ?? req.user.id,
      reviewedAt: data.review?.reviewedAt ?? new Date().toISOString(),
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
