import type { Metadata } from 'next'

import { companyDetails } from '../_legal/company'
import { H, LegalPage } from '../_legal/Page'

export const metadata: Metadata = { title: 'Privacy policy · Artisan Pro', robots: { index: true, follow: true } }
/** Rebuilt at most hourly: the company's details come from the backend. */
export const revalidate = 3600

export default async function PrivacyPage() {
  const c = await companyDetails()
  const contact = c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : 'your network administrator'
  return (
    <LegalPage title="Privacy policy" updated="12 October 2026">
      <p>
        This policy explains how {c.name} (&quot;we&quot;) collects and uses information in the Artisan Pro mobile app and the Reclimate dMRV
        platform. The app is used by biochar producers, kiln operators and supervisors to record biochar production so that carbon removal can
        be measured, reported and verified (dMRV).
      </p>

      <H>Information we collect</H>
      <ul>
        <li>
          <b>Account details</b>: your name, email address, phone number, village or address, role, and the network and site you work at. Your
          password is handled by Google Firebase Authentication; we never see it.
        </li>
        <li>
          <b>Production records</b> you enter: biomass collected, kiln burns, moisture and temperature readings, biochar quantities, mixing,
          packing and distribution of biochar, and the people you record it for (for example a farmer or buyer).
        </li>
        <li>
          <b>Photos and videos</b> you take in the app as evidence of each step, and your <b>profile photo</b> if you add one.
        </li>
        <li>
          <b>Location</b>: the precise location of the field where biochar is applied, only when you tap &quot;Save location&quot;. The app does not
          track your location in the background.
        </li>
        <li>
          <b>Device information</b>: the app version and phone model, so we can support older app versions and fix problems.
        </li>
      </ul>

      <H>How we use it</H>
      <ul>
        <li>To run the app: sign you in, show your site&apos;s work and let supervisors review it.</li>
        <li>To calculate and verify carbon removal and issue carbon credits, and to show you the credits you earned.</li>
        <li>To share evidence with carbon registries, standards bodies and independent verifiers when a project is audited.</li>
        <li>To keep the service secure, prevent abuse, and fix errors.</li>
      </ul>
      <p>We do not sell your information and we do not use it for advertising.</p>

      <H>Who we share it with</H>
      <ul>
        <li>Your network&apos;s supervisors and managers, and our administrators.</li>
        <li>Carbon registries, standards bodies and verifiers, for the batches they audit.</li>
        <li>
          Service providers that host the platform on our behalf: Google Firebase and Google Cloud (sign-in, file storage, hosting) and Neon
          (database). They process data only on our instructions.
        </li>
        <li>Authorities, when the law requires it.</li>
      </ul>

      <H>How long we keep it</H>
      <p>
        Production records and their evidence are kept for as long as the carbon credits they support must remain verifiable under the
        applicable standard. Account details are kept while your account is active and removed when you delete your account (see below).
      </p>

      <H>Deleting your account</H>
      <p>
        You can delete your account at any time in the app (Profile or Settings → Delete account), or by following the steps on our{' '}
        <a href="/account-deletion">account deletion page</a>. Your sign-in and personal details (name, email, phone, address, photo) are erased.
        Production records you made stay without your personal details, because they are evidence for issued carbon credits.
      </p>

      <H>Security</H>
      <p>
        Data is sent over encrypted connections (HTTPS). Photos and videos are private: only people at the same site and our administrators can
        see them. Access to the platform is limited by role and checked on every request.
      </p>

      <H>Children</H>
      <p>The app is meant for adults working in biochar production. We do not knowingly collect information from children under 13.</p>

      <H>Your rights</H>
      <p>
        You can see and correct your profile in the app, and ask us for a copy of your information or for it to be deleted, by contacting{' '}
        {contact}.
      </p>

      <H>Changes and contact</H>
      <p>
        We will update this page if our practices change. Questions: {contact}
        {c.address ? ` · ${c.address}` : ''}.
      </p>
    </LegalPage>
  )
}
