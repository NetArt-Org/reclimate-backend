import type { CollectionAfterChangeHook } from 'payload'

import type { Batch } from '@/payload-types'
import { relId } from '../access'

/**
 * When a batch is approved, the worker earns its credits — once.
 * Writes an "earned" row to credit-transactions (the app's credits history).
 */
export const creditOnApproval: CollectionAfterChangeHook<Batch> = async ({ doc, req }) => {
  if (doc.status !== 'approved' && doc.status !== 'done') return doc
  const worker = relId(doc.worker)
  if (!worker || !doc.credits) return doc

  const existing = await req.payload.count({
    collection: 'credit-transactions',
    where: { and: [{ batch: { equals: doc.id } }, { type: { equals: 'earned' } }] },
    req,
  })
  if (existing.totalDocs > 0) return doc

  const bio = doc.collect?.biomassType || 'Biochar'
  const tx = await req.payload.create({
    collection: 'credit-transactions',
    locale: 'en',
    data: {
      worker: worker as number,
      type: 'earned',
      amount: doc.credits,
      batch: doc.id,
      date: doc.review?.reviewedAt ?? new Date().toISOString(),
      title: `${bio} batch approved`,
    },
    req,
  })
  await req.payload.update({
    collection: 'credit-transactions',
    id: tx.id,
    locale: 'id',
    data: { title: `Batch ${bio.toLowerCase()} disetujui` },
    req,
  })

  return doc
}
