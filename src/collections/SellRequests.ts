import type { Access, CollectionConfig } from 'payload'

import { isAdmin, isLoggedIn, relId, roleOf } from '../access'

const readOwn: Access = ({ req }) => {
  if (!req.user) return false
  return roleOf(req) === 'admin' ? true : { worker: { equals: req.user.id } }
}

/** "Sell credits" on the Credits screen. An admin marks it paid, which debits the ledger. */
export const SellRequests: CollectionConfig = {
  slug: 'sell-requests',
  labels: { singular: 'Sell request', plural: 'Sell requests' },
  admin: {
    description:
      'Workers ask to sell their credits from the app. Set Status to Paid once the buyer has paid — that takes the credits off the worker\'s balance.',
    defaultColumns: ['worker', 'credits', 'buyer', 'status', 'createdAt'],
    group: 'Credits',
  },
  access: { read: readOwn, create: isLoggedIn, update: isAdmin, delete: isAdmin },
  hooks: {
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        if (operation === 'create' && req.user && roleOf(req) !== 'admin') {
          data.worker = req.user.id
          data.status = 'pending'
        }
        const settings = await req.payload.findGlobal({ slug: 'settings', req })
        if (operation === 'create') {
          data.pricePerCredit ??= settings.creditPrice
          data.buyer ||= settings.defaultBuyer
        }
        const credits = data.credits ?? originalDoc?.credits ?? 0
        const price = data.pricePerCredit ?? originalDoc?.pricePerCredit ?? 0
        data.totalValue = credits * price
        return data
      },
    ],
    afterChange: [
      async ({ doc, req }) => {
        if (doc.status !== 'paid') return doc
        const existing = await req.payload.count({
          collection: 'credit-transactions',
          where: { sellRequest: { equals: doc.id } },
          req,
        })
        if (existing.totalDocs > 0) return doc
        const buyer = doc.buyer || 'buyer'
        const tx = await req.payload.create({
          collection: 'credit-transactions',
          locale: 'en',
          data: {
            worker: relId(doc.worker) as number,
            type: 'sold',
            amount: -Math.abs(doc.credits),
            sellRequest: doc.id,
            date: new Date().toISOString(),
            title: `Sold to ${buyer}`,
          },
          req,
        })
        await req.payload.update({
          collection: 'credit-transactions',
          id: tx.id,
          locale: 'id',
          data: { title: `Dijual ke ${buyer}` },
          req,
        })
        return doc
      },
    ],
  },
  fields: [
    { name: 'worker', type: 'relationship', relationTo: 'users', required: true, index: true },
    {
      type: 'row',
      fields: [
        { name: 'credits', type: 'number', required: true, min: 0 },
        { name: 'pricePerCredit', label: 'Price per credit (Rp)', type: 'number' },
        { name: 'totalValue', label: 'Total value (Rp)', type: 'number', admin: { readOnly: true } },
      ],
    },
    { name: 'buyer', type: 'text' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Accepted', value: 'accepted' },
        { label: 'Paid', value: 'paid' },
        { label: 'Declined', value: 'declined' },
      ],
    },
    { name: 'note', type: 'textarea' },
  ],
}
