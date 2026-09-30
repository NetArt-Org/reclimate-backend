import type { CollectionConfig, Field } from 'payload'

import { isAdmin, isLoggedIn, isStaffField, ownOrSite } from '../access'

/** Computed by the server on save (see hooks/batchBeforeChange) — never accepted from a client. */
const computed = { create: () => false, update: () => false }
import { batchBeforeChange } from '../hooks/batchBeforeChange'
import { creditOnApproval } from '../hooks/creditOnApproval'

const photos = (name: string, label: string, description?: string): Field => ({
  name,
  label,
  type: 'upload',
  relationTo: 'media',
  hasMany: true,
  admin: description ? { description } : undefined,
})

/** Same keys as REJECT_REASONS in the app — the app maps each to the step to redo. */
export const REJECT_REASONS = [
  { label: 'Quench photo is blurry', value: 'quench' },
  { label: 'Firing photos are not clear', value: 'fire' },
  { label: 'Firing videos are too short', value: 'video' },
  { label: 'Moisture photos do not match the numbers', value: 'moist' },
  { label: 'Biochar amount looks wrong', value: 'qty' },
]

/**
 * One biochar batch, recorded over 4 days in the app's wizard.
 * Each tab below is one wizard day; field comments give the app's wizard key (`v.<key>`).
 */
export const Batches: CollectionConfig = {
  slug: 'batches',
  labels: { singular: 'Batch', plural: 'Batches' },
  admin: {
    useAsTitle: 'code',
    defaultColumns: ['code', 'status', 'worker', 'site', 'day', 'credits', 'startedAt'],
    listSearchableFields: ['code'],
    group: 'Production',
    description:
      'Each batch is one burn, recorded by a worker over 4 days. To review one: open it, check the photos in each Day tab, then set Status to Approved or Rejected and save.',
  },
  access: { read: ownOrSite, create: isLoggedIn, update: ownOrSite, delete: isAdmin },
  hooks: {
    beforeChange: [batchBeforeChange],
    afterChange: [creditOnApproval],
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'code', type: 'text', required: true, unique: true, admin: { description: 'e.g. B-2309' } },
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'progress',
          index: true,
          admin: {
            description:
              'Waiting approval = ready for a supervisor. Approved gives the worker their credits. Rejected sends it back with the reason on the Review tab.',
          },
          options: [
            { label: 'In progress', value: 'progress' },
            { label: 'Waiting approval', value: 'waiting' },
            { label: 'Approved', value: 'approved' },
            { label: 'Rejected', value: 'rejected' },
            { label: 'Complete', value: 'done' },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'day',
          type: 'number',
          required: true,
          defaultValue: 1,
          min: 1,
          max: 5,
          admin: { description: 'Current day 1–4, or 5 once every day is complete.' },
        },
        {
          name: 'step',
          type: 'number',
          required: true,
          defaultValue: 0,
          min: 0,
          admin: { description: 'Furthest unlocked step within the current day (0-based).' },
        },
        { name: 'startedAt', type: 'date', defaultValue: () => new Date().toISOString() },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'worker', type: 'relationship', relationTo: 'users', required: true, index: true },
        { name: 'site', type: 'relationship', relationTo: 'sites', index: true },
        {
          name: 'credits',
          type: 'number',
          access: computed,
          admin: { readOnly: true, description: 'Biochar litres × credit factor (Settings).' },
        },
      ],
    },
    {
      type: 'tabs',
      tabs: [
        {
          name: 'collect',
          label: 'Day 1 · Collect biomass',
          fields: [
            { name: 'source', type: 'text', admin: { description: 'Biomass source or farmer (v.source)' } },
            { name: 'biomassType', type: 'text', admin: { description: 'e.g. Corn Cob (v.btype)' } },
            {
              type: 'row',
              fields: [
                { name: 'quantity', type: 'number', min: 0, admin: { description: 'v.qty' } },
                {
                  name: 'unit',
                  type: 'select',
                  defaultValue: 'kg',
                  options: [
                    { label: 'kg', value: 'kg' },
                    { label: 'ton', value: 'ton' },
                  ],
                },
                {
                  name: 'weightKg',
                  type: 'number',
                  access: computed,
                  admin: { readOnly: true, description: 'Computed' },
                },
              ],
            },
            {
              name: 'transport',
              type: 'select',
              options: [
                { label: 'By hand or cart', value: 'manual' },
                { label: 'Truck or car', value: 'vehicle' },
              ],
            },
            photos('photos', 'Biomass photos', '2 required (v.bphoto)'),
          ],
        },
        {
          name: 'burn',
          label: 'Day 2 · Burn',
          fields: [
            { name: 'kiln', type: 'text', admin: { description: 'v.kiln' } },
            {
              name: 'moisture',
              type: 'array',
              maxRows: 5,
              admin: { description: '5 readings, each with a photo of the meter. Must be ≤ max moisture (v.moist)' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'value', type: 'number', min: 0, max: 100, admin: { description: '%' } },
                    { name: 'photo', type: 'upload', relationTo: 'media' },
                  ],
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'startedAt',
                  type: 'date',
                  admin: { date: { pickerAppearance: 'dayAndTime' }, description: 'v.burn' },
                },
                {
                  name: 'endedAt',
                  type: 'date',
                  admin: { date: { pickerAppearance: 'dayAndTime' }, description: 'v.burnEnd' },
                },
              ],
            },
            photos('firingPhotos', 'Firing photos', '3 required (v.firePh)'),
            photos('firingVideos', 'Firing videos', '3 required, ~5 s each (v.fireVid)'),
            {
              name: 'temperatureC',
              label: 'Temperature (°C)',
              type: 'number',
              admin: { description: 'Usually 500–700 °C (v.temp)' },
            },
            photos('preQuenchPhotos', 'Before quench', '1 required (v.preq)'),
            photos('quenchPhotos', 'After quench', '1 required (v.quench)'),
            {
              name: 'litres',
              label: 'Biochar made (L)',
              type: 'number',
              min: 0,
              admin: { description: 'v.litres' },
            },
          ],
        },
        {
          name: 'mix',
          label: 'Day 3 · Mix & pack',
          fields: [
            {
              name: 'mixType',
              type: 'select',
              options: [
                { label: 'Biochar-Compost 1:1', value: 'compost-1-1' },
                { label: 'Biochar only', value: 'biochar-only' },
              ],
            },
            {
              name: 'biocharUsedL',
              label: 'Biochar used (L)',
              type: 'number',
              min: 0,
              admin: { description: 'Cannot exceed biochar made (v.mixL)' },
            },
            photos('photos', 'Mixing photos', '2 required (v.mixPh)'),
            {
              type: 'row',
              fields: [
                { name: 'bagType', type: 'text', admin: { description: 'v.bag' } },
                { name: 'bagCount', type: 'number', min: 0, admin: { description: 'v.bags' } },
              ],
            },
            photos('packPhotos', 'Packing photo', '1 required (v.packPh)'),
          ],
        },
        {
          name: 'apply',
          label: 'Day 4 · Give & apply',
          fields: [
            { name: 'receiver', type: 'text', admin: { description: 'Farmer or buyer (v.to)' } },
            { name: 'bagsGiven', type: 'number', min: 0, admin: { description: 'v.giveBags' } },
            photos('photos', 'Field photos', '2 required (v.applyPh)'),
            {
              type: 'row',
              fields: [
                { name: 'latitude', type: 'number' },
                { name: 'longitude', type: 'number' },
              ],
            },
            { name: 'locationLabel', type: 'text', admin: { description: 'As shown in the app (v.loc)' } },
          ],
        },
        {
          name: 'review',
          label: 'Review',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'reviewedBy',
                  type: 'relationship',
                  relationTo: 'users',
                  access: { create: isStaffField, update: isStaffField },
                },
                {
                  name: 'reviewedAt',
                  type: 'date',
                  admin: { date: { pickerAppearance: 'dayAndTime' } },
                  access: { create: isStaffField, update: isStaffField },
                },
              ],
            },
            {
              name: 'rejectReason',
              type: 'select',
              admin: { description: 'Only needed when Status is Rejected. The worker is sent back to redo this step.' },
              options: REJECT_REASONS,
              access: { create: isStaffField, update: isStaffField },
            },
            {
              name: 'rejectNote',
              type: 'textarea',
              admin: { description: 'Optional message shown to the worker.' },
              access: { create: isStaffField, update: isStaffField },
            },
          ],
        },
      ],
    },
  ],
}
