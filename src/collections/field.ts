import type { CollectionConfig } from 'payload'

import { adminOnly, num, rel, uuidId } from './shared'

/**
 * Collections for features of the field app that Circonomy did not have.
 * Admin-only over the REST API; the field app reaches them through /api/field (src/field).
 */

/** A worker asking to sell their credits ("Sell to buyer" on the app's Credits screen). An admin settles it. */
export const SellRequests: CollectionConfig = {
  slug: 'sell-requests',
  access: adminOnly,
  defaultSort: '-createdAt',
  fields: [
    uuidId,
    rel('person', 'people', { required: true }),
    rel('network', 'networks'),
    rel('site', 'sites'),
    num('creditsT', { required: true, min: 0 }),
    { name: 'buyer', type: 'text' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Paid', value: 'paid' },
        { label: 'Declined', value: 'declined' },
      ],
    },
    { name: 'note', type: 'textarea' },
    { name: 'decidedBy', type: 'text' },
    { name: 'decidedAt', type: 'date' },
  ],
}

/** Per-site pick lists the field app keeps that have no collection of their own: bags, crops and buyers. */
export const SiteLists: CollectionConfig = {
  slug: 'site-lists',
  access: adminOnly,
  fields: [
    uuidId,
    rel('site', 'sites', { required: true }),
    {
      name: 'category',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Packaging bag', value: 'bags' },
        { label: 'Preferred crop', value: 'crops' },
        { label: 'Buyer', value: 'buyers' },
      ],
    },
    { name: 'name', type: 'text', required: true },
    { name: 'detail', type: 'text' },
    rel('createdBy', 'people'),
  ],
}
