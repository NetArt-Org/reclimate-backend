import type { CollectionConfig } from 'payload'

import { isLoggedIn, roleOf, siteWhere } from '../access'

/**
 * Photos and videos captured in the wizard, plus profile photos.
 * Files are written to ./media on local disk for now; swap in the S3 storage
 * adapter (@payloadcms/storage-s3) in payload.config.ts later — no field changes needed.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Photo / video', plural: 'Photos & videos' },
  admin: {
    group: 'Production',
    defaultColumns: ['filename', 'uploadedBy', 'capturedAt', 'createdAt'],
    description: 'Everything captured in the app. Open a batch to see its photos in context.',
  },
  access: {
    // Evidence is private: a worker sees their own files, a supervisor their site's.
    // This also guards the file URLs (/api/media/file/…), not just the list.
    read: ({ req }) => {
      if (!req.user) return false
      if (roleOf(req) === 'admin') return true
      if (roleOf(req) === 'supervisor') return siteWhere(req, 'uploadedBy.site')
      return { uploadedBy: { equals: req.user.id } }
    },
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
