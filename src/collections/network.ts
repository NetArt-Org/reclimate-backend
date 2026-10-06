import type { CollectionConfig } from 'payload'

import { adminOnly, latLng, num, raw, rel, uuidId } from './shared'

/** Partner organisation (country entity) that owns networks — the "ID01" / "MY01" prefix of a batch ID. */
export const Organizations: CollectionConfig = {
  slug: 'organizations',
  access: adminOnly,
  fields: [
    uuidId,
    { name: 'code', type: 'text', required: true, unique: true },
    { name: 'name', type: 'text', required: true },
    { name: 'country', type: 'text' },
    { name: 'address', type: 'text' },
    { name: 'active', type: 'checkbox', defaultValue: true },
    { name: 'admins', type: 'json', defaultValue: [] },
    { name: 'standards', type: 'json' },
    raw,
  ],
}

/** A production network: Artisan Pro (kilns) or C-sink (farmers). */
export const Networks: CollectionConfig = {
  slug: 'networks',
  access: adminOnly,
  fields: [
    uuidId,
    rel('organization', 'organizations', { required: true }),
    { name: 'code', type: 'text', index: true },
    { name: 'name', type: 'text', required: true },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'artisan',
      options: [
        { label: 'Artisan Pro', value: 'artisan' },
        { label: 'C-sink network', value: 'csink' },
      ],
    },
    { name: 'location', type: 'text' },
    { name: 'address', type: 'text' },
    { name: 'country', type: 'text' },
    ...latLng,
    { name: 'active', type: 'checkbox', defaultValue: true },
    { name: 'ceresApproved', type: 'checkbox', defaultValue: false },
    { name: 'methaneStrategy', type: 'text' },
    { name: 'certifiedAt', type: 'date' },
    /** Feedstocks, mixing/application types, pre-processing steps and lab references. */
    { name: 'config', type: 'json' },
    { name: 'kml', type: 'json' },
    raw,
  ],
}

export const Sites: CollectionConfig = {
  slug: 'sites',
  access: adminOnly,
  fields: [
    uuidId,
    rel('network', 'networks', { required: true }),
    { name: 'code', type: 'text' },
    { name: 'name', type: 'text', required: true },
    { name: 'address', type: 'text' },
    ...latLng,
    { name: 'active', type: 'checkbox', defaultValue: true },
    { name: 'kml', type: 'json' },
    raw,
  ],
}

export const Kilns: CollectionConfig = {
  slug: 'kilns',
  access: adminOnly,
  fields: [
    uuidId,
    rel('site', 'sites', { required: true }),
    { name: 'code', type: 'text' },
    { name: 'name', type: 'text', required: true },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Kon-Tiki', value: 'kontiki' },
        { label: 'Pit', value: 'pit' },
      ],
    },
    num('volumeM3'),
    { name: 'shape', type: 'text' },
    /** Dimensions in mm, keyed by name (upperDiameter, lowerDiameter, depth, …). */
    { name: 'dimensions', type: 'json' },
    ...latLng,
    { name: 'active', type: 'checkbox', defaultValue: true },
    raw,
  ],
}

/** Field people on a network: managers, supervisors, kiln operators and farmers. They do not sign in to /admin. */
export const People: CollectionConfig = {
  slug: 'people',
  access: adminOnly,
  fields: [
    uuidId,
    { name: 'name', type: 'text', required: true, index: true },
    {
      name: 'role',
      type: 'select',
      required: true,
      options: ['manager', 'supervisor', 'operator', 'farmer'].map((v) => ({ label: v, value: v })),
    },
    { name: 'email', type: 'text' },
    { name: 'phone', type: 'text' },
    rel('organization', 'organizations'),
    rel('networks', 'networks', { hasMany: true }),
    rel('sites', 'sites', { hasMany: true }),
    { name: 'active', type: 'checkbox', defaultValue: true },
    { name: 'otpBypass', type: 'checkbox', defaultValue: false },
    { name: 'photo', type: 'text' },
    { name: 'trainingDocs', type: 'json', defaultValue: [] },
    { name: 'device', type: 'json' },
    { name: 'address', type: 'text' },
    ...latLng,
    raw,
  ],
}

export const Vehicles: CollectionConfig = {
  slug: 'vehicles',
  access: adminOnly,
  fields: [
    uuidId,
    rel('network', 'networks'),
    rel('site', 'sites'),
    { name: 'name', type: 'text' },
    { name: 'plate', type: 'text', required: true },
    { name: 'type', type: 'text' },
    { name: 'fuel', type: 'text' },
    num('emissionFactor'),
    raw,
  ],
}

/** Measuring containers (volume of biochar per batch) and sampling containers (lab samples kept 6 months). */
export const Containers: CollectionConfig = {
  slug: 'containers',
  access: adminOnly,
  fields: [
    uuidId,
    {
      name: 'kind',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Measuring container', value: 'measuring' },
        { label: 'Sampling container', value: 'sampling' },
      ],
    },
    rel('site', 'sites'),
    rel('network', 'networks'),
    { name: 'code', type: 'text', index: true },
    { name: 'name', type: 'text' },
    { name: 'shape', type: 'text' },
    /** Dimensions in mm. */
    { name: 'dimensions', type: 'json' },
    num('volumeL'),
    { name: 'inUse', type: 'checkbox', defaultValue: false },
    { name: 'filled', type: 'checkbox', defaultValue: false },
    { name: 'addedAt', type: 'date' },
    raw,
  ],
}

/** Where biomass comes from (Circonomy calls these FPUs): a landfill, plantation, farm… */
export const BiomassSources: CollectionConfig = {
  slug: 'biomass-sources',
  access: adminOnly,
  fields: [
    uuidId,
    rel('site', 'sites'),
    rel('network', 'networks'),
    { name: 'name', type: 'text', required: true },
    { name: 'address', type: 'text' },
    ...latLng,
    { name: 'active', type: 'checkbox', defaultValue: true },
    { name: 'kml', type: 'json' },
    raw,
  ],
}
