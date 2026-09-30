import type { Access, FieldAccess, PayloadRequest, Where } from 'payload'

/** Id of a relationship value, whether it is populated or not. */
export const relId = (v: unknown): number | string | undefined => {
  if (v == null) return undefined
  if (typeof v === 'object') return (v as { id?: number | string }).id
  return v as number | string
}

export const roleOf = (req: PayloadRequest) => req.user?.role
export const siteOf = (req: PayloadRequest) => relId(req.user?.site)

export const isAdmin: Access = ({ req }) => roleOf(req) === 'admin'
export const isLoggedIn: Access = ({ req }) => !!req.user

export const isAdminField: FieldAccess = ({ req }) => roleOf(req) === 'admin'
/** Supervisors and admins — the people who review batches. */
export const isStaffField: FieldAccess = ({ req }) =>
  roleOf(req) === 'admin' || roleOf(req) === 'supervisor'

/** Documents of the user's own site; nothing when the user has no site. */
export const siteWhere = (req: PayloadRequest, field = 'site'): Where | false => {
  const site = siteOf(req)
  return site ? { [field]: { equals: site } } : false
}

/** Admins see everything; everyone else only documents of their own site. */
export const sameSite: Access = ({ req }) => {
  if (!req.user) return false
  if (roleOf(req) === 'admin') return true
  return siteWhere(req)
}

/**
 * Admins see everything, supervisors their site's documents,
 * workers only what they own (documents with a `worker` relationship).
 */
export const ownOrSite: Access = ({ req }) => {
  if (!req.user) return false
  if (roleOf(req) === 'admin') return true
  if (roleOf(req) === 'supervisor') return siteWhere(req)
  return { worker: { equals: req.user.id } } satisfies Where
}
