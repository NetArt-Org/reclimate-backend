import type { Metadata } from 'next'

import { companyDetails } from '../_legal/company'
import { H, LegalPage } from '../_legal/Page'

export const metadata: Metadata = { title: 'Delete your account · Artisan Pro', robots: { index: true, follow: true } }
export const revalidate = 3600

/** Google Play asks for a web page explaining how to delete an account made in the app. */
export default async function AccountDeletionPage() {
  const c = await companyDetails()
  return (
    <LegalPage title="Delete your Artisan Pro account" updated="12 October 2026">
      <H>In the app</H>
      <ol>
        <li>Open Artisan Pro and sign in.</li>
        <li>
          Go to <b>Profile</b> (or <b>Settings</b> in the Classic layout) and tap <b>Delete account</b>.
        </li>
        <li>Confirm. You are signed out and the account is deleted straight away.</li>
      </ol>
      <H>Without the app</H>
      <p>
        Email {c.email ? <a href={`mailto:${c.email}?subject=Delete%20my%20Artisan%20Pro%20account`}>{c.email}</a> : 'your network administrator'}{' '}
        from the address you sign in with, asking to delete your account. We do it within 30 days and confirm by email.
      </p>
      <H>What is deleted</H>
      <ul>
        <li>Your sign-in (email, password or Google link).</li>
        <li>Your name, email address, phone number, village or address and profile photo.</li>
      </ul>
      <H>What is kept</H>
      <p>
        Production records you entered (batches, readings, photos and videos of the work) stay, without your name or contact details, because
        they are evidence for carbon credits that registries may audit. They are kept as long as the applicable standard requires.
      </p>
    </LegalPage>
  )
}
