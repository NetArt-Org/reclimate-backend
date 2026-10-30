'use server'

import type { Change } from './audit'
import { requireAdmin } from './payload'
import { guard, UserError } from './result'

export interface HistoryEntry {
  id: string
  at: string
  by: string
  byEmail: string
  action: string
  message: string
  changes: Change[]
}

/** The edit history of one record (newest first): who changed what, when, from which value to which. */
export async function getHistory(entity: string, entityId: string) {
  return guard(async (): Promise<HistoryEntry[]> => {
    const { payload } = await requireAdmin()
    if (typeof entity !== 'string' || !/^[a-z-]{1,40}$/.test(entity)) throw new UserError('Unknown record')
    if (typeof entityId !== 'string' || !/^[\w-]{1,64}$/.test(entityId)) throw new UserError('Unknown record')
    const res = await payload.find({
      collection: 'activity-logs',
      where: { and: [{ entity: { equals: entity } }, { entityId: { equals: entityId } }] },
      sort: '-at',
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })
    return res.docs.map((d) => ({
      id: String(d.id),
      at: String(d.at ?? d.createdAt),
      by: d.by ?? '',
      byEmail: (d as { byEmail?: string | null }).byEmail ?? '',
      action: d.actionType ?? '',
      message: d.message,
      changes: Array.isArray((d as { changes?: unknown }).changes) ? ((d as { changes: Change[] }).changes) : [],
    }))
  })()
}
