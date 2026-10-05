import type { Access, CollectionConfig, FieldAccess, Where } from 'payload'

import { isAdmin, isAdminField, roleOf, siteOf, siteWhere } from '../access'

/** Digits only, so "+62 812-0000-0000" and "6281200000000" are the same login. */
export const phoneToUsername = (phone: string) => phone.replace(/\D/g, '')

const readUsers: Access = ({ req }) => {
  if (!req.user) return false
  if (roleOf(req) === 'admin') return true
  const self: Where = { id: { equals: req.user.id } }
  if (roleOf(req) === 'supervisor') return siteWhere(req) || self
  // Workers: themselves, plus the supervisors of their site (the "Supervisors" screen).
  const site = siteOf(req)
  if (!site) return self
  return { or: [self, { and: [{ role: { equals: 'supervisor' } }, { site: { equals: site } }] }] }
}

// Creating a user is admin-only (see `access.create`), so the only signed-out
// create is Payload's "create first user" screen — which must be able to pick Admin.
const adminOrFirstUser: FieldAccess = ({ req }) => !req.user || roleOf(req) === 'admin'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Person', plural: 'People' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'role', 'phone', 'site'],
    listSearchableFields: ['name', 'phone', 'village'],
    group: 'People',
    description:
      'Everyone who can sign in. Workers and supervisors use the phone app with their phone number and PIN; admins use this panel.',
  },
  auth: {
    // The app signs in with phone number + PIN: the phone's digits are the username.
    loginWithUsername: { allowEmailLogin: true, requireEmail: false },
    // Field workers are often offline for days — keep them signed in for 30 days.
    tokenExpiration: 60 * 60 * 24 * 30,
    maxLoginAttempts: 10,
    lockTime: 10 * 60 * 1000,
    cookies: {
      // Strict works while the app and this server share a site (localhost, or
      // app.example.com + api.example.com). Hosting them on unrelated domains
      // needs COOKIE_SAMESITE=None, which browsers only accept over HTTPS.
      sameSite: (process.env.COOKIE_SAMESITE as 'Lax' | 'None' | 'Strict' | undefined) || 'Strict',
      secure: process.env.NODE_ENV === 'production',
    },
  },
  access: {
    admin: ({ req }) => roleOf(req) === 'admin',
    read: readUsers,
    create: isAdmin,
    update: ({ req }) => {
      if (!req.user) return false
      return roleOf(req) === 'admin' ? true : { id: { equals: req.user.id } }
    },
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [
      ({ data, originalDoc }) => {
        if (!data) return data
        // Field accounts sign in with their phone number: keep the username in step with it.
        // Admins choose their own username, so editing an admin's phone never changes their login.
        const role = data.role ?? originalDoc?.role
        if (role !== 'admin' && data.phone && (!data.username || data.phone !== originalDoc?.phone)) {
          data.username = phoneToUsername(data.phone)
        } else if (typeof data.username === 'string' && /^[\d\s+().-]+$/.test(data.username)) {
          // Someone typed the number as "+62 812-0000-0000": the app signs in with digits only.
          data.username = phoneToUsername(data.username)
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'worker',
      saveToJWT: true,
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Supervisor', value: 'supervisor' },
        { label: 'Worker (artisan)', value: 'worker' },
      ],
      access: { create: adminOrFirstUser, update: isAdminField },
    },
    {
      name: 'site',
      type: 'relationship',
      relationTo: 'sites',
      admin: { description: 'Where this person works. They only see batches and setup lists of this site.' },
      access: { create: adminOrFirstUser, update: isAdminField },
    },
    {
      name: 'phone',
      type: 'text',
      admin: {
        description:
          'e.g. +62 812-0000-0000. This is what the person types to sign in to the app (the Username is filled in from it).',
      },
    },
    { name: 'village', label: 'Village / address', type: 'text' },
    {
      name: 'jobTitle',
      type: 'text',
      localized: true,
      admin: {
        description: 'Shown on the Supervisors screen, e.g. "Lead supervisor".',
        condition: (data) => data?.role === 'supervisor',
      },
    },
    { name: 'avatar', label: 'Profile photo', type: 'upload', relationTo: 'media' },
    {
      name: 'lang',
      label: 'App language',
      type: 'select',
      defaultValue: 'en',
      options: [
        { label: 'English', value: 'en' },
        { label: 'Bahasa Indonesia', value: 'id' },
      ],
    },
  ],
}
