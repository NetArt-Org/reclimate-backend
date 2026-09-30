import type { GlobalConfig } from 'payload'

import { roleOf } from '../access'

/** Numbers the app currently hardcodes in src/data/constants.ts and src/lib/batch.ts. */
export const Settings: GlobalConfig = {
  slug: 'settings',
  label: 'Credit & quality settings',
  admin: { group: 'Setup', description: 'The numbers used to turn biochar into credits. Changes apply to batches saved afterwards.' },
  access: {
    read: ({ req }) => !!req.user,
    update: ({ req }) => roleOf(req) === 'admin',
  },
  fields: [
    {
      name: 'creditFactor',
      type: 'number',
      required: true,
      defaultValue: 0.1,
      admin: { description: 'Credits earned per litre of biochar (CREDIT_FACTOR).' },
    },
    {
      name: 'creditPrice',
      label: 'Credit price (Rp)',
      type: 'number',
      required: true,
      defaultValue: 150000,
      admin: { description: 'CREDIT_PRICE' },
    },
    {
      name: 'creditGoal',
      type: 'number',
      required: true,
      defaultValue: 1000,
      admin: { description: 'Credits needed before a worker can sell (CREDIT_GOAL).' },
    },
    {
      name: 'maxMoisture',
      label: 'Max moisture (%)',
      type: 'number',
      required: true,
      defaultValue: 15,
      admin: { description: 'Readings above this block the burn (MAX_MOISTURE).' },
    },
    { name: 'defaultBuyer', type: 'text', defaultValue: 'PT Hijau Karbon (sample)' },
  ],
}
