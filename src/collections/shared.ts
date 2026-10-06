import { randomUUID } from 'crypto'
import type { Access, CollectionConfig, Field } from 'payload'

export const isAdmin: Access = ({ req }) => req.user?.role === 'admin'
export const isSignedIn: Access = ({ req }) => !!req.user

/** Admin-only over the REST API (a viewer or demoted account reads nothing). Server code uses the Local API. */
export const adminOnly: CollectionConfig['access'] = { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin }

/**
 * UUID primary key. Records imported from the Circonomy exports keep their source UUID,
 * so batch, kiln and mixing IDs match the old system one-to-one.
 */
export const uuidId: Field = { name: 'id', type: 'text', defaultValue: () => randomUUID() }

export const rel = (name: string, relationTo: string, extra: Partial<Field> = {}): Field =>
  ({ name, type: 'relationship', relationTo, index: true, ...extra }) as Field

export const num = (name: string, extra: Partial<Field> = {}): Field => ({ name, type: 'number', ...extra }) as Field

export const latLng: Field[] = [num('lat'), num('lng')]

/** The full source record from Circonomy, kept so no migrated detail is lost (secrets and ID documents stripped). */
export const raw: Field = { name: 'raw', type: 'json', admin: { hidden: true } }
