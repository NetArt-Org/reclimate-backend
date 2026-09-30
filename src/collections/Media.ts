import type { CollectionConfig } from 'payload'

import { isLoggedIn, roleOf } from '../access'

/**
 * Photos and videos captured in the wizard, plus profile photos.
 * Files are written to ./media on local disk for now; swap in the S3 storage
 * adapter (@payloadcms/storage-s3) in payload.config.ts later — no field changes needed.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  admin: { group: 'Evidence' },
  access: {
    // Public so the app can show files in plain <img>/<video> tags.
    // Tighten (signed URLs) when moving to S3.
    read: () => true,
    create: isLoggedIn,
    update: ({ req }) => {
      if (!req.user) return false
      return roleOf(req) === 'admin' ? true : { uploadedBy: { equals: req.user.id } }
    },
    delete: ({ req }) => {
      if (!req.user) return false
      return roleOf(req) === 'admin' ? true : { uploadedBy: { equals: req.user.id } }
    },
  },
  hooks: {
    beforeChange: [
      ({ data, req, operation }) => {
        if (operation === 'create' && req.user && !data.uploadedBy) data.uploadedBy = req.user.id
        return data
      },
    ],
  },
  upload: {
    mimeTypes: ['image/*', 'video/*'],
    imageSizes: [{ name: 'thumbnail', width: 400 }],
    adminThumbnail: 'thumbnail',
  },
  fields: [
    { name: 'alt', type: 'text' },
    { name: 'capturedAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    {
      type: 'row',
      fields: [
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
      ],
    },
    { name: 'uploadedBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
  ],
}
