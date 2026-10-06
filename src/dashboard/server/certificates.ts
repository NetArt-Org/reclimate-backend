'use server'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from './payload'
import { guard, MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, UserError } from './result'
import { deleteDroppedUploads, storeUpload } from './storage'

export interface SigningAuthority {
  name: string
  designation: string
  signatureFileId?: string | null
}

/** Stored as `company.certificateSettings`. */
export interface CertificateSettings {
  companyName: string
  email: string
  /** Full number including the country code, e.g. "+65 6123 4567". */
  phone: string
  logoFileId: string | null
  sideImageFileId?: string | null
  signingAuthorities: SigningAuthority[]
}

/** Images that /admin/files serves inline (never SVG). */
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const fileId = (v: unknown) => (typeof v === 'string' && v ? v : null)

export async function getCertificateSettings() {
  return guard(async (): Promise<CertificateSettings> => {
    const { payload } = await requireAdmin()
    const company = await payload.findGlobal({ slug: 'company', depth: 0, overrideAccess: true })
    const raw = (company.certificateSettings && typeof company.certificateSettings === 'object' && !Array.isArray(company.certificateSettings)
      ? company.certificateSettings
      : {}) as Record<string, unknown>
    const authorities = Array.isArray(raw.signingAuthorities) ? (raw.signingAuthorities as Record<string, unknown>[]) : []
    return {
      companyName: str(raw.companyName) || company.name || '',
      email: str(raw.email) || company.email || '',
      phone: str(raw.phone) || company.phone || '',
      logoFileId: fileId(raw.logoFileId),
      sideImageFileId: fileId(raw.sideImageFileId),
      signingAuthorities: authorities.map((a) => ({
        name: str(a?.name),
        designation: str(a?.designation),
        signatureFileId: fileId(a?.signatureFileId),
      })),
    }
  })()
}

export async function saveCertificateSettings(s: CertificateSettings) {
  return guard(async () => {
    const { payload } = await requireAdmin()
    const data: CertificateSettings = {
      companyName: s.companyName.trim(),
      email: s.email.trim().toLowerCase(),
      phone: s.phone.trim(),
      logoFileId: fileId(s.logoFileId),
      sideImageFileId: fileId(s.sideImageFileId),
      signingAuthorities: (s.signingAuthorities ?? []).map((a) => ({
        name: a.name.trim(),
        designation: a.designation.trim(),
        signatureFileId: fileId(a.signatureFileId),
      })),
    }
    if (!data.companyName) throw new UserError('Enter the company name')
    if (!EMAIL.test(data.email)) throw new UserError('Enter a valid email address')
    if (!/\d{4,}/.test(data.phone.replace(/\D/g, ''))) throw new UserError('Enter a phone number')
    if (!data.logoFileId) throw new UserError('Upload a logo')
    if (data.signingAuthorities.some((a) => !a.name || !a.designation)) throw new UserError('Every signing authority needs a name and designation')

    const before = await payload.findGlobal({ slug: 'company', depth: 0, overrideAccess: true })
    await payload.updateGlobal({ slug: 'company', data: { certificateSettings: data as never }, overrideAccess: true })
    // A replaced logo, side image or signature is deleted from storage.
    await deleteDroppedUploads(before.certificateSettings, data)
    revalidatePath('/admin/settings')
  })()
}

/** Upload a logo, side image or signature. Returns the file id (shown via /admin/files/<id>). */
export async function uploadCertificateImage(form: FormData) {
  return guard(async (): Promise<{ id: string; url: string }> => {
    await requireAdmin()
    const file = form.get('file')
    if (!(file instanceof File) || !file.size) throw new UserError('Choose an image')
    if (!IMAGE_TYPES.includes(file.type)) throw new UserError('Use a PNG, JPG, WebP or GIF image')
    if (file.size > MAX_UPLOAD_BYTES) throw new UserError(`Images can be at most ${MAX_UPLOAD_LABEL}`)
    const doc = await storeUpload(file, { collection: 'company', id: 'certificate', category: 'certificate' })
    return { id: doc.id, url: doc.url ?? `/admin/files/${doc.id}` }
  })()
}
