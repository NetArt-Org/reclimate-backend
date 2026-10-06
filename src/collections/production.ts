import type { CollectionConfig } from 'payload'

import { adminOnly, num, raw, rel, uuidId } from './shared'

/** Biomass types and how their baseline methane is treated in the carbon calculation. */
export const Feedstocks: CollectionConfig = {
  slug: 'feedstocks',
  access: adminOnly,
  fields: [
    uuidId,
    { name: 'name', type: 'text', required: true, unique: true },
    {
      name: 'strategy',
      type: 'select',
      options: [
        { label: 'Methane config strategy', value: 'methane' },
        { label: 'Compensation', value: 'compensation' },
        { label: 'Avoidance', value: 'avoidance' },
      ],
    },
    /** Uses a site-specific carbon (SPC) value instead of the default. */
    { name: 'spc', type: 'checkbox', defaultValue: false },
    num('carbonContent', { admin: { description: '% of dry biochar mass' } }),
    num('bulkDensity', { admin: { description: 'kg/m³ of biochar' } }),
    { name: 'volumeTracking', type: 'checkbox', defaultValue: false },
  ],
}

export const BATCH_STATUSES = [
  { label: 'Started', value: 'started' },
  { label: 'Not assessed', value: 'not_assessed' },
  { label: 'Approved (network)', value: 'approved' },
  { label: 'Approved', value: 'admin_approved' },
  { label: 'Rejected (network)', value: 'rejected' },
  { label: 'Rejected', value: 'admin_rejected' },
]

/** One kiln firing. Imported rows keep the Circonomy batch UUID as their id and the BatchID as `code`. */
export const Batches: CollectionConfig = {
  slug: 'batches',
  access: adminOnly,
  defaultSort: '-date',
  fields: [
    uuidId,
    { name: 'code', type: 'text', required: true, unique: true },
    { name: 'date', type: 'date', required: true, index: true },
    rel('network', 'networks', { required: true }),
    rel('site', 'sites', { required: true }),
    rel('kiln', 'kilns'),
    { name: 'startDate', type: 'date' },
    { name: 'endedAt', type: 'date' },
    { name: 'feedstock', type: 'text', index: true },
    num('biomassKg'),
    num('biocharL'),
    num('bulkDensity'),
    num('carbonContent'),
    /** Total carbon sink of the batch, t CO₂e. */
    num('csinkT'),
    rel('operator', 'people'),
    { name: 'operatorName', type: 'text' },
    { name: 'status', type: 'select', required: true, index: true, defaultValue: 'not_assessed', options: BATCH_STATUSES },
    { name: 'assessedBy', type: 'text' },
    { name: 'assessorEmail', type: 'text' },
    { name: 'sinkApproved', type: 'checkbox', defaultValue: false, index: true },
    { name: 'registered', type: 'checkbox', defaultValue: false, index: true },
    { name: 'rejectionReason', type: 'textarea' },
    { name: 'assessedAt', type: 'date' },
    /** Field measurements and emissions (from the batch record). */
    num('temperatureC'),
    { name: 'moistureReadings', type: 'json' },
    num('co2EmissionKg'),
    num('methaneEmissionKg'),
    num('shortTermSinkT'),
    num('kilnVolumeL'),
    rel('samplingContainer', 'containers'),
    raw,
  ],
}

export const BiomassCollections: CollectionConfig = {
  slug: 'biomass-collections',
  access: adminOnly,
  defaultSort: '-date',
  fields: [
    uuidId,
    { name: 'date', type: 'date', required: true, index: true },
    rel('network', 'networks', { required: true }),
    rel('site', 'sites', { required: true }),
    rel('farmer', 'people'),
    { name: 'feedstock', type: 'text' },
    { name: 'source', type: 'text' },
    num('quantityKg'),
    {
      name: 'transport',
      type: 'select',
      defaultValue: 'manual',
      options: [
        { label: 'Manual', value: 'manual' },
        { label: 'Vehicle', value: 'vehicle' },
      ],
    },
    rel('vehicle', 'vehicles'),
    { name: 'vehicleDetails', type: 'text' },
    num('emissionFactor'),
    num('distanceKm'),
    num('emissions'),
    rel('biomassSource', 'biomass-sources'),
    raw,
  ],
}

export const Mixings: CollectionConfig = {
  slug: 'mixings',
  access: adminOnly,
  defaultSort: '-date',
  fields: [
    uuidId,
    { name: 'date', type: 'date', required: true, index: true },
    rel('batches', 'batches', { hasMany: true }),
    rel('network', 'networks', { required: true }),
    rel('site', 'sites', { required: true }),
    { name: 'mixingType', type: 'text' },
    num('biocharL'),
    num('otherMaterialKg'),
    num('totalKg'),
    { name: 'bagDetails', type: 'text' },
    num('bagsCreated'),
    num('bagsAvailable'),
    { name: 'description', type: 'textarea' },
    num('rejectedBiocharL'),
    raw,
  ],
}

export const Packagings: CollectionConfig = {
  slug: 'packagings',
  access: adminOnly,
  defaultSort: '-date',
  fields: [
    uuidId,
    { name: 'date', type: 'date', required: true, index: true },
    rel('batches', 'batches', { hasMany: true }),
    rel('network', 'networks', { required: true }),
    rel('site', 'sites', { required: true }),
    { name: 'packagingType', type: 'text' },
    num('biocharKg'),
    num('mixKg'),
    { name: 'bagDetails', type: 'text' },
    num('bagsCreated'),
    num('bagsDistributed'),
    num('bagsRemaining'),
    { name: 'description', type: 'textarea' },
    num('rejectedBiocharL'),
    raw,
  ],
}

/** Packed bags of biochar product, ready to distribute. */
export const Inventories: CollectionConfig = {
  slug: 'inventories',
  access: adminOnly,
  defaultSort: '-packedAt',
  fields: [
    uuidId,
    { name: 'code', type: 'text', index: true },
    rel('network', 'networks'),
    rel('site', 'sites'),
    rel('batches', 'batches', { hasMany: true }),
    { name: 'packagingType', type: 'text' },
    { name: 'bagType', type: 'text' },
    num('bagQuantity'),
    { name: 'bagUnit', type: 'text' },
    num('actualQuantity'),
    { name: 'packedAt', type: 'date', index: true },
    { name: 'status', type: 'text' },
    raw,
  ],
}

/** Biochar applied to soil or distributed to farmers — the sink (Production → Sink). */
export const Applications: CollectionConfig = {
  slug: 'applications',
  access: adminOnly,
  defaultSort: '-date',
  fields: [
    uuidId,
    { name: 'date', type: 'date', required: true, index: true },
    rel('network', 'networks'),
    rel('site', 'sites'),
    { name: 'recipientName', type: 'text' },
    { name: 'recipientPhone', type: 'text' },
    { name: 'recipientAddress', type: 'text' },
    num('lat'),
    num('lng'),
    { name: 'mixTypes', type: 'json' },
    { name: 'mode', type: 'text' },
    { name: 'vehicle', type: 'text' },
    { name: 'kind', type: 'text' },
    { name: 'open', type: 'checkbox', defaultValue: false },
    { name: 'fullySinked', type: 'checkbox', defaultValue: false },
    raw,
  ],
}
