'use server'

import { randomUUID } from 'crypto'

import { ANALYSIS_FIELDS, REQUIRED_ANALYSIS, type AnalysisKey, type LabKind, type LabReport } from '../data/lab'
import type { Network } from '../data/types'
import { record } from './audit'
import { labStatuses } from './lab-status'
import { invalidateDashboard, relId, requireAdmin } from './payload'
import { guard, MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, UserError } from './result'
import { deleteUploads, storeUpload } from './storage'

/** One feedstock's reports and per-network status (Settings → Feedstock management → Lab reports). */
export async function feedstockLab(feedstockId: string) {
  return guard(async () => {
    const { payload } = await requireAdmin()
    if (typeof feedstockId !== 'string' || !/^[\w-]{1,64}$/.test(feedstockId)) throw new UserError('Unknown feedstock')
    const f = await payload.findByID({ collection: 'feedstocks', id: feedstockId, depth: 0, overrideAccess: true }).catch(() => null)
    if (!f) throw new UserError('This feedstock no longer exists')
    const [rows, statuses] = await Promise.all([
      payload.find({ collection: 'lab-reports', where: { feedstock: { equals: feedstockId } }, depth: 1, overrideAccess: true, pagination: false, sort: '-reportDate' }),
      labStatuses(f.name),
    ])
    const reports: LabReport[] = rows.docs.map((r) => {
      const file = r.file && typeof r.file === 'object' ? r.file : null
      const values: LabReport['values'] = {}
      for (const { key } of ANALYSIS_FIELDS) values[key] = (r[key] as number | null | undefined) ?? null
      return {
        id: String(r.id),
        kind: r.kind,
        networkId: relId(r.network) ?? '',
        reportDate: r.reportDate,
        bulkDensity: r.bulkDensity ?? null,
        values,
        producedM3: r.producedM3 ?? null,
        note: r.note ?? '',
        uploadedBy: r.uploadedBy ?? '',
        file: file ? { id: String(file.id), name: file.name, size: file.size ?? 0 } : null,
      }
    })
    return { reports, statuses }
  })()
}

const numberField = (form: FormData, key: string, label: string, max: number) => {
  const raw = String(form.get(key) ?? '').trim().replace(',', '.')
  if (!raw) return null
  const v = Number(raw)
  if (!Number.isFinite(v) || v < 0 || v > max) throw new UserError(`${label} must be a number between 0 and ${max}`)
  return v
}

/**
 * Add a lab report for a feedstock at a network, with its file. It becomes the network's lab reference for the
 * feedstock: bulk density from either kind, carbon content from an analysis' total carbon.
 */
export async function addLabReport(form: FormData) {
  return guard(async () => {
    const admin = await requireAdmin()
    const { payload } = admin
    const feedstockId = String(form.get('feedstockId') ?? '')
    const networkId = String(form.get('networkId') ?? '')
    const kind = String(form.get('kind') ?? '') as LabKind
    if (kind !== 'bulk-density' && kind !== 'analysis') throw new UserError('Choose the kind of report')
    const [f, net] = await Promise.all([
      /^[\w-]{1,64}$/.test(feedstockId) ? payload.findByID({ collection: 'feedstocks', id: feedstockId, depth: 0, overrideAccess: true }).catch(() => null) : null,
      /^[\w-]{1,64}$/.test(networkId) ? payload.findByID({ collection: 'networks', id: networkId, depth: 0, overrideAccess: true }).catch(() => null) : null,
    ])
    if (!f) throw new UserError('Unknown feedstock')
    if (!net) throw new UserError('Choose the network')
    const date = String(form.get('reportDate') ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw new UserError('Enter the report date')
    if (Date.parse(date) > Date.now() + 86_400_000) throw new UserError('The report date cannot be in the future')

    const bulkDensity = numberField(form, 'bulkDensity', 'Bulk density', 5000)
    const values: Partial<Record<AnalysisKey, number | null>> = {}
    for (const { key, label } of ANALYSIS_FIELDS) values[key] = numberField(form, key, label, key === 'ph' ? 14 : key === 'hcRatio' ? 10 : 100)
    if (kind === 'bulk-density' && bulkDensity == null) throw new UserError('Enter the bulk density (kg/m³)')
    if (kind === 'analysis') {
      const missing = ANALYSIS_FIELDS.filter((x) => REQUIRED_ANALYSIS.includes(x.key) && values[x.key] == null).map((x) => x.label.toLowerCase())
      if (missing.length) throw new UserError(`Enter at least: ${missing.join(', ')}`)
    }
    const file = form.get('file')
    if (!(file instanceof File) || !file.size) throw new UserError('Attach the lab report file')
    if (file.size > MAX_UPLOAD_BYTES) throw new UserError(`Files can be at most ${MAX_UPLOAD_LABEL}`)

    // Biochar made so far, so the next bulk-density report is due 100 m³ from here.
    const now = (await labStatuses(f.name)).find((s) => s.networkId === networkId)
    const id = randomUUID()
    const stored = await storeUpload(file, { collection: 'lab-reports', id, category: 'lab-report' })
    await payload.create({
      collection: 'lab-reports',
      data: {
        id,
        feedstock: feedstockId,
        network: networkId,
        kind,
        reportDate: new Date(`${date}T12:00:00Z`).toISOString(),
        file: stored.id,
        bulkDensity: kind === 'bulk-density' || bulkDensity != null ? bulkDensity : null,
        ...(kind === 'analysis' ? values : {}),
        producedM3: now?.producedM3 ?? 0,
        note: String(form.get('note') ?? '').trim().slice(0, 300) || null,
        uploadedBy: admin.user.name || admin.user.email,
      },
      overrideAccess: true,
    } as never)

    // The network's lab reference for this feedstock (what the app's credit estimates use).
    const config = (net.config ?? {}) as unknown as Network['config']
    const refs = [...(config.references ?? [])]
    const i = refs.findIndex((r) => r.feedstock === f.name)
    // A new reference starts from the feedstock's own values (0 = use the feedstock's).
    const ref = i >= 0 ? { ...refs[i] } : { feedstock: f.name, bulkDensity: f.bulkDensity ?? 0, carbonContent: f.carbonContent ?? 0 }
    if (bulkDensity != null) ref.bulkDensity = bulkDensity
    if (kind === 'analysis' && values.carbonTotal != null) ref.carbonContent = values.carbonTotal
    if (i >= 0) refs[i] = ref
    else refs.push(ref)
    await payload.update({ collection: 'networks', id: networkId, data: { config: { ...config, references: refs } as never }, overrideAccess: true })

    await record(admin, {
      entity: 'lab-reports',
      entityId: id,
      action: 'create',
      message: `${kind === 'analysis' ? 'Lab analysis' : 'Bulk density report'} for ${f.name} at ${net.name} added`,
      network: networkId,
    })
    invalidateDashboard()
  })()
}

/** Remove a lab report (its file goes too). The network's lab reference is left as it is. */
export async function deleteLabReport(id: string) {
  return guard(async () => {
    const admin = await requireAdmin()
    const { payload } = admin
    if (typeof id !== 'string' || !/^[\w-]{1,64}$/.test(id)) throw new UserError('Unknown report')
    const r = await payload.findByID({ collection: 'lab-reports', id, depth: 0, overrideAccess: true }).catch(() => null)
    if (!r) throw new UserError('This report no longer exists')
    await payload.delete({ collection: 'lab-reports', id, overrideAccess: true })
    const fileId = relId(r.file)
    if (fileId) await deleteUploads([fileId])
    await record(admin, { entity: 'lab-reports', entityId: id, action: 'delete', message: 'Lab report removed', network: relId(r.network) })
    invalidateDashboard()
  })()
}
