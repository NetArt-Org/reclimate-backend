import type { CollectionConfig } from 'payload'

import { adminOnly, num, uuidId } from './shared'

/** Reusable kiln and measuring-container shapes (Settings → Templates). */
export const Templates: CollectionConfig = {
  slug: 'templates',
  access: adminOnly,
  fields: [
    uuidId,
    {
      name: 'kind',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Kiln', value: 'kiln' },
        { label: 'Measuring container', value: 'container' },
      ],
    },
    { name: 'name', type: 'text', required: true },
    { name: 'kilnType', type: 'select', options: [{ label: 'Kon-Tiki', value: 'kontiki' }, { label: 'Pit', value: 'pit' }] },
    { name: 'shape', type: 'text', required: true },
    { name: 'unit', type: 'select', defaultValue: 'cm', options: ['mm', 'cm', 'm'].map((v) => ({ label: v, value: v })) },
    /** Dimension values in `unit`, keyed by name (upperDiameter, depth, …). */
    { name: 'dimensions', type: 'json', required: true },
    num('volumeL'),
  ],
}

/**
 * Every file: uploads, and photos/videos/PDFs migrated from Circonomy. The bytes live in Firebase Storage
 * (`storagePath`); Neon keeps what the file is and what it belongs to. Served by /admin/files/<id> to admins.
 */
export const Files: CollectionConfig = {
  slug: 'files',
  access: adminOnly,
  // Files are always looked up by the record they belong to.
  indexes: [{ fields: ['ownerCollection', 'ownerId'] }],
  fields: [
    uuidId,
    { name: 'name', type: 'text', required: true },
    { name: 'mimeType', type: 'text', required: true },
    num('size'),
    { name: 'storagePath', type: 'text' },
    /** Where a migrated file came from (s3://prod-circo/…). */
    { name: 'sourcePath', type: 'text', index: true },
    /** firing, temperature, moisture, transportation, packaging, kiln, certificate… */
    { name: 'category', type: 'text', index: true },
    /** The record this file belongs to, e.g. batches / <uuid>. */
    { name: 'ownerCollection', type: 'text', index: true },
    { name: 'ownerId', type: 'text', index: true },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'stored',
      index: true,
      options: [
        { label: 'Stored', value: 'stored' },
        { label: 'Waiting to copy', value: 'pending' },
        { label: 'Copy failed', value: 'failed' },
      ],
    },
    /** Legacy: small files saved in Neon before Firebase Storage was set up. */
    { name: 'data', type: 'textarea', access: { read: () => false } },
  ],
}

export const Alerts: CollectionConfig = {
  slug: 'alerts',
  access: adminOnly,
  defaultSort: '-createdAt',
  fields: [
    uuidId,
    { name: 'kind', type: 'select', required: true, options: ['bulk-density', 'certificate', 'kiln'].map((v) => ({ label: v, value: v })) },
    { name: 'message', type: 'text', required: true },
    { name: 'network', type: 'relationship', relationTo: 'networks' },
    { name: 'request', type: 'json' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'open',
      index: true,
      options: ['open', 'approved', 'rejected', 'dismissed'].map((v) => ({ label: v, value: v })),
    },
  ],
}

export const ActivityLogs: CollectionConfig = {
  slug: 'activity-logs',
  access: adminOnly,
  defaultSort: '-createdAt',
  fields: [
    uuidId,
    { name: 'message', type: 'text', required: true },
    { name: 'network', type: 'relationship', relationTo: 'networks' },
    { name: 'by', type: 'text' },
    { name: 'actionType', type: 'text' },
    /** When it happened (imported entries keep their original time). */
    { name: 'at', type: 'date', index: true },
  ],
}
