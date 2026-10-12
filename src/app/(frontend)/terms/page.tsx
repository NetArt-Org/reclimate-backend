import type { Metadata } from 'next'

import { companyDetails } from '../_legal/company'
import { H, LegalPage } from '../_legal/Page'

export const metadata: Metadata = { title: 'Terms of use · Artisan Pro', robots: { index: true, follow: true } }
export const revalidate = 3600

export default async function TermsPage() {
  const c = await companyDetails()
  return (
    <LegalPage title="Terms of use" updated="12 October 2026">
      <p>
        These terms apply to the Artisan Pro app and the Reclimate dMRV platform operated by {c.name}. By signing in you agree to them.
      </p>
      <H>Your account</H>
      <p>
        Accounts are given by your network administrator or requested in the app and approved by an administrator. Keep your password private
        and tell your administrator if you think someone else used your account. We may suspend accounts that are misused.
      </p>
      <H>Honest records</H>
      <p>
        Records, readings, photos and videos must be genuine and taken at the time and place they describe. They are used to issue carbon
        credits; false or copied evidence can lead to batches being rejected and your access being removed.
      </p>
      <H>Credits</H>
      <p>
        Credits shown in the app are estimates until a batch is approved by an administrator and verified. Sell requests are settled by your
        network according to its agreements; the app records the request, it does not make payments.
      </p>
      <H>Fair use</H>
      <p>Do not try to access other people&apos;s data, overload the service, or use it for anything other than recording biochar work.</p>
      <H>Privacy</H>
      <p>
        How we handle your information is explained in the <a href="/privacy">privacy policy</a>.
      </p>
      <H>Contact</H>
      <p>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : 'Your network administrator'}</p>
    </LegalPage>
  )
}
