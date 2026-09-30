import type { CollectionConfig } from 'payload'

import { isAdmin, isLoggedIn } from '../access'

export const Sites: CollectionConfig = {
  slug: 'sites',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'region', 'active'],
    group: 'Setup',
    description: 'Production sites. Every worker, supervisor and batch belongs to one.',
  },
  access: { read: isLoggedIn, create: isAdmin, update: isAdmin, delete: isAdmin },
  fields: [
    { name: 'name', type: 'text', required: true, unique: true },
    { name: 'region', type: 'text' },
    { name: 'active', type: 'checkbox', defaultValue: true },
  ],
}
