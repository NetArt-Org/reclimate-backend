import type { CollectionConfig } from 'payload'

import { isAdmin, isLoggedIn } from '../access'

export const Sites: CollectionConfig = {
  slug: 'sites',
  admin: { useAsTitle: 'name', group: 'Setup' },
  access: { read: isLoggedIn, create: isAdmin, update: isAdmin, delete: isAdmin },
  fields: [
    { name: 'name', type: 'text', required: true, unique: true },
    { name: 'region', type: 'text' },
    { name: 'active', type: 'checkbox', defaultValue: true },
  ],
}
