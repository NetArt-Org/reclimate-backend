import 'server-only'

import config from '@payload-config'
import { getPayload } from 'payload'

/** The company's details for the public pages, from the backend's company profile (Settings → Company). */
export async function companyDetails() {
  try {
    const payload = await getPayload({ config })
    const c = await payload.findGlobal({ slug: 'company', depth: 0, overrideAccess: true })
    return {
      name: c.name || 'Reclimate',
      email: c.email || '',
      phone: c.phone || '',
      address: c.address || '',
    }
  } catch {
    return { name: 'Reclimate', email: '', phone: '', address: '' }
  }
}
