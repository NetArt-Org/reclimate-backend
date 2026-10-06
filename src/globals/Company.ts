import type { GlobalConfig } from 'payload'

/**
 * The C-sink manager company that owns this workspace. Profile fields are columns;
 * the nested settings the admin edits as a unit (contacts, app rules, projects…) are JSON.
 */
export const Company: GlobalConfig = {
  slug: 'company',
  access: { read: ({ req }) => req.user?.role === 'admin', update: ({ req }) => req.user?.role === 'admin' },
  fields: [
    { name: 'name', type: 'text', required: true, defaultValue: 'Reclimate Pte Ltd' },
    { name: 'kind', type: 'text', defaultValue: 'C-sink manager' },
    { name: 'address', type: 'text' },
    { name: 'email', type: 'text' },
    { name: 'phone', type: 'text' },
    { name: 'dmrvProvider', type: 'text' },
    { name: 'profile', type: 'json', admin: { description: 'Contacts, documents, services, standards, app rules, projects, certificates, audit trail.' } },
    /** Certificate generator: logo, side image and signing authorities. */
    { name: 'certificateSettings', type: 'json' },
    { name: 'raw', type: 'json' },
  ],
}
