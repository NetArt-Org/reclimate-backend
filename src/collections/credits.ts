import type { CollectionConfig } from 'payload'

import { adminOnly, num, raw, rel, uuidId } from './shared'

/** Unassigned carbon inventory generated on the registry (Stocks ledger). */
export const Stocks: CollectionConfig = {
  slug: 'stocks',
  access: adminOnly,
  defaultSort: '-generatedAt',
  fields: [
    uuidId,
    { name: 'stockId', type: 'text', required: true, unique: true },
    { name: 'code', type: 'text' },
    rel('network', 'networks'),
    { name: 'feedstock', type: 'text' },
    num('biocharT'),
    num('creditsT'),
    { name: 'producedAt', type: 'date' },
    { name: 'generatedAt', type: 'date', index: true },
    /** Some details were not available when the record was imported. */
    { name: 'partial', type: 'checkbox', defaultValue: false },
    { name: 'deleted', type: 'checkbox', defaultValue: false, index: true },
    num('carbonContent'),
    { name: 'status', type: 'text' },
    /** CERES certificates: { id, body, date, fileId } */
    { name: 'certificates', type: 'json' },
    raw,
  ],
}

/** A stock assigned to a blending matrix (Sinks ledger). */
export const Sinks: CollectionConfig = {
  slug: 'sinks',
  access: adminOnly,
  defaultSort: '-date',
  fields: [
    uuidId,
    { name: 'sinkId', type: 'text', required: true, unique: true },
    { name: 'date', type: 'date', required: true, index: true },
    rel('stock', 'stocks'),
    num('biocharT'),
    { name: 'matrixId', type: 'text' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
    },
    { name: 'deleted', type: 'checkbox', defaultValue: false, index: true },
    /** Monitoring reports: { description, code, fileId } */
    { name: 'reports', type: 'json' },
    raw,
  ],
}

/** Compliance documents (CSI, CERES, verification statements). The file itself lives in `files`. */
export const Documents: CollectionConfig = {
  slug: 'documents',
  access: adminOnly,
  defaultSort: '-issuedAt',
  fields: [
    uuidId,
    { name: 'title', type: 'text', required: true },
    {
      name: 'category',
      type: 'select',
      required: true,
      defaultValue: 'csi-compliance',
      options: [
        { label: 'CSI compliance', value: 'csi-compliance' },
        { label: 'Certificate', value: 'certificate' },
        { label: 'Other', value: 'other' },
      ],
    },
    { name: 'reference', type: 'text' },
    { name: 'issuedAt', type: 'date' },
    { name: 'expiresAt', type: 'date' },
    rel('file', 'files'),
    raw,
  ],
}
