/* eslint-disable @next/next/no-img-element -- images come from the authenticated /admin/files route, not next/image */
import { Leaf } from 'lucide-react'

import type { CertificateSettings } from '../server/certificates'

const fileUrl = (id: string | null | undefined) => (id ? `/admin/files/${encodeURIComponent(id)}` : null)

/** DOM id of the certificate; the print stylesheet prints only this element. */
export const CERTIFICATE_PRINT_ID = 'certificate-print'

/**
 * Print only the certificate, on one A4 landscape page.
 * Everything else is hidden with `visibility` so the certificate keeps its own layout.
 */
export const CERTIFICATE_PRINT_CSS = `
@media print {
  @page { size: A4 landscape; margin: 0; }
  html, body { background: #fff !important; }
  body * { visibility: hidden !important; }
  #${CERTIFICATE_PRINT_ID}, #${CERTIFICATE_PRINT_ID} * { visibility: visible !important; }
  #${CERTIFICATE_PRINT_ID} {
    position: fixed !important; left: 0 !important; top: 0 !important;
    width: 297mm !important; height: 210mm !important; max-width: none !important;
    border: 0 !important; border-radius: 0 !important; box-shadow: none !important;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
}
`

/**
 * A4 landscape certificate rendered from the certificate settings. Sizes use container
 * query units (cqw) so the layout scales from the small preview up to the printed page.
 */
export function CertificatePreview({ settings }: { settings: CertificateSettings }) {
  const logo = fileUrl(settings.logoFileId)
  const side = fileUrl(settings.sideImageFileId)
  const company = settings.companyName.trim() || 'Your company name'
  const authorities = settings.signingAuthorities.filter((a) => a.name.trim() || a.designation.trim() || a.signatureFileId)
  const contact = [settings.email.trim(), settings.phone.trim()].filter(Boolean).join('  ·  ')

  return (
    <div
      id={CERTIFICATE_PRINT_ID}
      className="@container relative aspect-[297/210] w-full overflow-hidden rounded-lg border border-line bg-white text-[#1c211e] shadow-sm"
      role="img"
      aria-label={`Certificate of Carbon Removal preview for ${company}`}
    >
      <div className="flex h-full">
        {/* Side strip */}
        <div className="relative h-full w-[22%] shrink-0 overflow-hidden bg-[#1f5a3d]">
          {side ? (
            <img src={side} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-[linear-gradient(160deg,#2c7a52_0%,#1f5a3d_45%,#163f2b_100%)]">
              <Leaf className="absolute top-1/2 left-1/2 size-[8cqw] -translate-x-1/2 -translate-y-1/2 text-white/25" aria-hidden />
            </div>
          )}
          <div className="absolute inset-y-0 right-0 w-[0.5cqw] bg-[#c9a85c]" />
        </div>

        {/* Body */}
        <div className="relative flex min-w-0 flex-1 flex-col px-[5cqw] pt-[3.6cqw] pb-[2.8cqw]">
          <div className="pointer-events-none absolute inset-[1.6cqw] rounded-[0.6cqw] border-[0.15cqw] border-[#c9a85c]/60" />

          <div className="relative flex items-center justify-between gap-[2cqw]">
            {logo ? (
              <img src={logo} alt="" className="h-[5.5cqw] max-w-[22cqw] object-contain object-left" />
            ) : (
              <div className="flex h-[5.5cqw] w-[14cqw] items-center justify-center rounded-[0.5cqw] border-[0.12cqw] border-dashed border-[#cfd6cc] text-[1.1cqw] text-[#9aa09b]">
                Logo
              </div>
            )}
            <div className="text-right text-[1cqw] leading-tight tracking-[0.18em] text-[#6b726d] uppercase">
              Certificate No.
              <div className="mt-[0.3cqw] font-mono text-[1.2cqw] tracking-normal text-[#3f4742]">RC-0000-0000</div>
            </div>
          </div>

          <div className="relative mt-[2.6cqw] text-center">
            <div className="text-[1.3cqw] font-semibold tracking-[0.3em] text-[#1f5a3d] uppercase">{company}</div>
            <h3 className="mt-[0.8cqw] font-serif text-[4cqw] leading-none font-normal text-[#163f2b]">Certificate of Carbon Removal</h3>
            <div className="mx-auto mt-[1.4cqw] h-[0.15cqw] w-[10cqw] bg-[#c9a85c]" />
            <p className="mt-[1.8cqw] text-[1.3cqw] text-[#6b726d] italic">This certifies that</p>
            <div className="mx-auto mt-[1cqw] w-[60%] border-b-[0.12cqw] border-[#9aa09b] pb-[0.4cqw] font-serif text-[2.6cqw] leading-tight text-[#9aa09b]">
              Beneficiary name
            </div>
            <p className="mx-auto mt-[1.6cqw] max-w-[80%] text-[1.35cqw] leading-relaxed text-[#3f4742]">
              has permanently removed{' '}
              <span className="inline-block min-w-[7cqw] border-b-[0.12cqw] border-[#9aa09b] font-semibold text-[#9aa09b]">00.00</span>{' '}
              tonnes of CO<sub>2</sub>e from the atmosphere through biochar carbon removal.
            </p>
          </div>

          <div className="relative mt-auto flex items-end justify-between gap-[3cqw]">
            <div className="text-[1cqw] leading-snug text-[#6b726d]">
              <div className="tracking-[0.18em] uppercase">Date of issue</div>
              <div className="mt-[0.3cqw] text-[1.2cqw] text-[#3f4742]">DD Month YYYY</div>
            </div>
            <div className="flex min-w-0 flex-1 justify-end gap-[3cqw]">
              {(authorities.length ? authorities : [{ name: 'Signing authority', designation: 'Designation', signatureFileId: null }]).map((a, i) => {
                const sig = fileUrl(a.signatureFileId)
                return (
                  <div key={i} className="flex w-[16cqw] min-w-0 flex-col items-center text-center">
                    <div className="flex h-[4.5cqw] w-full items-end justify-center">
                      {sig && <img src={sig} alt="" className="max-h-full max-w-full object-contain" />}
                    </div>
                    <div className="w-full border-t-[0.12cqw] border-[#3f4742] pt-[0.5cqw]">
                      <div className="truncate text-[1.25cqw] font-semibold">{a.name.trim() || 'Name'}</div>
                      <div className="truncate text-[1cqw] text-[#6b726d]">{a.designation.trim() || 'Designation'}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {contact && <div className="relative mt-[1.4cqw] text-center text-[0.95cqw] tracking-wide text-[#6b726d]">{contact}</div>}
        </div>
      </div>
    </div>
  )
}
