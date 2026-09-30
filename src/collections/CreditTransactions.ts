import type { Access, CollectionConfig } from 'payload'

import { isAdmin, roleOf, siteWhere } from '../access'

const readTransactions: Access = ({ req }) => {
  if (!req.user) return false
  if (roleOf(req) === 'admin') return true
  if (roleOf(req) === 'supervisor') return siteWhere(req, 'worker.site')
  return { worker: { equals: req.user.id } }
}

/**
 * The credits ledger behind the app's Credits screen.
 * earned = sum of positive amounts, sold = sum of negative amounts.
 * Rows are written by hooks (batch approved, sell request paid) or by an admin.
 */
export const CreditTransactions: CollectionConfig = {
  slug: 'credit-transactions',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'worker', 'type', 'amount', 'date'],
    group: 'Credits',
  },
  access: { read: readTransactions, create: isAdmin, update: isAdmin, delete: isAdmin },
  fields: [
    { name: 'worker', type: 'relationship', relationTo: 'users', required: true, index: true },
    {
      type: 'row',
      fields: [
        {
          name: 'type',
          type: 'select',
          required: true,
          options: [
            { label: 'Earned', value: 'earned' },
            { label: 'Sold', value: 'sold' },
            { label: 'Adjustment', value: 'adjustment' },
          ],
        },
        {
          name: 'amount',
          type: 'number',
          required: true,
          admin: { description: 'Credits. Positive when earned, negative when sold.' },
        },
        { name: 'date', type: 'date', required: true, defaultValue: () => new Date().toISOString() },
      ],
    },
    { name: 'title', type: 'text', localized: true },
    { name: 'batch', type: 'relationship', relationTo: 'batches' },
    { name: 'sellRequest', type: 'relationship', relationTo: 'sell-requests' },
  ],
}
