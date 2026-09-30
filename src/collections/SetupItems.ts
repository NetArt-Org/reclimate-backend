import type { CollectionConfig } from 'payload'

import { isLoggedIn, roleOf, sameSite, siteOf } from '../access'

/** Same keys as SETUP in the app's src/data/constants.ts. */
export const SETUP_CATEGORIES = [
  { label: 'Kilns', value: 'kilns' },
  { label: 'Biomass sources', value: 'sources' },
  { label: 'Farmers', value: 'farmers' },
  { label: 'Vehicles', value: 'vehicles' },
  { label: 'Biomass reference', value: 'bioref' },
  { label: 'Measuring containers', value: 'measure' },
  { label: 'Sampling containers', value: 'sample' },
  { label: 'Packaging bags', value: 'bags' },
  { label: 'Preferred crops', value: 'crops' },
  { label: 'Buyers', value: 'buyers' },
]

/** The per-site lists under Profile → Site setup (kilns, farmers, bags…). */
export const SetupItems: CollectionConfig = {
  slug: 'setup-items',
  labels: { singular: 'Site setup item', plural: 'Site setup lists' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'category', 'detail', 'site'],
    listSearchableFields: ['name', 'detail'],
    group: 'Setup',
    description:
      'The choices workers pick from in the app: kilns, biomass sources, farmers, bags, buyers… Filter by Category to see one list.',
  },
  access: { read: sameSite, create: isLoggedIn, update: sameSite, delete: sameSite },
  hooks: {
    beforeChange: [
      ({ data, req, operation }) => {
        if (operation !== 'create' || !req.user) return data
        data.createdBy = req.user.id
        // Non-admins can only add to their own site.
        if (roleOf(req) !== 'admin' || !data.site) data.site = siteOf(req)
        return data
      },
    ],
  },
  fields: [
    { name: 'category', type: 'select', required: true, index: true, options: SETUP_CATEGORIES },
    { name: 'name', type: 'text', required: true },
    {
      name: 'detail',
      type: 'text',
      admin: { description: 'Second line in the app: capacity, phone, plate number, volume…' },
    },
    { name: 'site', type: 'relationship', relationTo: 'sites', index: true },
    { name: 'createdBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
  ],
}
