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
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'role', 'phone', 'site'],
    group: 'People',
  },
  auth: {
    // The app signs in with phone number + PIN: the phone's digits are the username.
    loginWithUsername: { allowEmailLogin: true, requireEmail: false },
    // Field workers are often offline for days — keep them signed in for 30 days.
    tokenExpiration: 60 * 60 * 24 * 30,
    maxLoginAttempts: 10,
    lockTime: 10 * 60 * 1000,
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
      ({ data }) => {
        if (data?.phone && !data.username) data.username = phoneToUsername(data.phone)
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
      access: { create: adminOrFirstUser, update: isAdminField },
    },
    {
      name: 'phone',
      type: 'text',
      admin: { description: 'As shown in the app, e.g. +62 812-0000-0000. Its digits become the login username.' },
    },
    { name: 'village', type: 'text' },
    {
      name: 'jobTitle',
      type: 'text',
      localized: true,
      admin: {
        description: 'Shown on the Supervisors screen, e.g. "Lead supervisor".',
        condition: (data) => data?.role === 'supervisor',
      },
    },
    { name: 'avatar', type: 'upload', relationTo: 'media' },
    {
      name: 'lang',
      type: 'select',
      defaultValue: 'en',
      options: [
        { label: 'English', value: 'en' },
        { label: 'Bahasa Indonesia', value: 'id' },
      ],
    },
  ],
}
