'use server'

import { revalidatePath } from 'next/cache'

import type { Feedstock } from '../data/types'
import { requireAdmin } from './payload'
import { guard, UserError } from './result'

export interface Template {
  id: string
  kind: 'kiln' | 'container'
  name: string
  kilnType: 'kontiki' | 'pit' | null
  shape: string
  unit: 'mm' | 'cm' | 'm'
  /** Values in `unit`, e.g. { upperDiameter: 180, lowerDiameter: 60, depth: 90 } */
  dimensions: Record<string, number>
  volumeL: number
}

export async function listTemplates() {
  return guard(async (): Promise<Template[]> => {
    const { payload } = await requireAdmin()
    const res = await payload.find({ collection: 'templates', pagination: false, depth: 0, sort: 'name', overrideAccess: true })
    return res.docs.map((t) => ({
      id: String(t.id),
      kind: t.kind,
      name: t.name,
      kilnType: t.kilnType ?? null,
      shape: t.shape,
      unit: t.unit ?? 'cm',
      dimensions: (t.dimensions as Record<string, number>) ?? {},
      volumeL: t.volumeL ?? 0,
    }))
  })()
}

const KINDS = ['kiln', 'container'] as const
const KILN_TYPES = ['kontiki', 'pit'] as const
const UNITS = ['mm', 'cm', 'm'] as const
const STRATEGIES = ['methane', 'compensation', 'avoidance'] as const

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v)
const optionalId = (v: unknown) => (typeof v === 'string' && v ? v : undefined)

/** Finite, non-negative number or null (empty). Anything else is rejected with `message`. */
function numberOrNull(v: unknown, message: string, max = Number.MAX_SAFE_INTEGER): number | null {
  if (v == null || v === '') return null
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max) throw new UserError(message)
  return v
}

export async function saveTemplate(t: Omit<Template, 'id'> & { id?: string }) {
  return guard(async () => {
    const { payload } = await requireAdmin()
    const id = optionalId(t?.id)
    const name = text(t?.name)
    if (!name) throw new UserError('Give the template a name')
    if (name.length > 120) throw new UserError('Template names can be at most 120 characters')
    if (!oneOf(KINDS, t.kind)) throw new UserError('Choose kiln or container')
    if (!oneOf(UNITS, t.unit)) throw new UserError('Choose mm, cm or m')
    const shape = text(t.shape)
    if (!shape) throw new UserError('Choose a shape')
    if (shape.length > 40) throw new UserError('The shape can be at most 40 characters')
    const kilnType = t.kind === 'kiln' && oneOf(KILN_TYPES, t.kilnType) ? t.kilnType : null

    const raw = t.dimensions
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new UserError('Enter the dimensions')
    const entries = Object.entries(raw as Record<string, unknown>)
    if (entries.length > 12) throw new UserError('A template can have at most 12 dimensions')
    const dimensions: Record<string, number> = {}
    for (const [k, v] of entries) {
      if (!k || k.length > 40) throw new UserError('Unknown dimension')
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new UserError('Dimensions must be positive numbers')
      dimensions[k] = v
    }
    const volumeL = t.volumeL
    if (typeof volumeL !== 'number' || !Number.isFinite(volumeL) || volumeL < 0 || volumeL > 10_000_000) {
      throw new UserError('The volume must be between 0 and 10,000,000 L')
    }

    const data = { kind: t.kind, name, kilnType, shape, unit: t.unit, dimensions, volumeL }
    if (id) await payload.update({ collection: 'templates', id, data, overrideAccess: true })
    else await payload.create({ collection: 'templates', data, overrideAccess: true } as never)
    revalidatePath('/admin/settings')
  })()
}

export async function deleteTemplate(id: string) {
  return guard(async () => {
    const { payload } = await requireAdmin()
    await payload.delete({ collection: 'templates', id, overrideAccess: true })
    revalidatePath('/admin/settings')
  })()
}

/** Update a feedstock's strategy and lab values, or add a new feedstock (no id). */
export async function saveFeedstock(f: Omit<Feedstock, 'id'> & { id?: string }) {
  return guard(async () => {
    const { payload } = await requireAdmin()
    const id = optionalId(f?.id)
    const name = text(f?.name)
    if (!name) throw new UserError('Give the feedstock a name')
    if (name.length > 120) throw new UserError('Feedstock names can be at most 120 characters')
    if (f.strategy != null && !oneOf(STRATEGIES, f.strategy)) throw new UserError('Unknown strategy')
    const data = {
      name,
      strategy: f.strategy ?? null,
      spc: f.spc === true,
      bulkDensity: numberOrNull(f.bulkDensity, 'Bulk density must be a positive number'),
      carbonContent: numberOrNull(f.carbonContent, 'Carbon content must be between 0 and 100 %', 100),
      volumeTracking: f.volumeTracking === true,
    }
    try {
      if (id) await payload.update({ collection: 'feedstocks', id, data, overrideAccess: true })
      else await payload.create({ collection: 'feedstocks', data, overrideAccess: true } as never)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/unique|duplicate|already/i.test(msg)) throw new UserError(`A feedstock called ${name} already exists`)
      throw err
    }
    revalidatePath('/admin', 'layout')
  })()
}
