/**
 * Demo data — the same sample content the app ships in src/data/mock.ts.
 *
 *   npm run seed                 seed an empty database
 *   SEED_RESET=true npm run seed wipe the demo collections first, then seed
 *
 * Needs SEED_ADMIN_PASSWORD and SEED_DEMO_PIN in .env.
 */
import { getPayload, type CollectionSlug } from 'payload'

import config from '../payload.config'
import type { Batch } from '@/payload-types'
import { phoneToUsername } from '../collections/Users'

const adminPassword = process.env.SEED_ADMIN_PASSWORD
const pin = process.env.SEED_DEMO_PIN
if (!adminPassword || !pin) {
  console.error('Set SEED_ADMIN_PASSWORD and SEED_DEMO_PIN in .env before seeding.')
  process.exit(1)
}

const payload = await getPayload({ config })

const WIPE: CollectionSlug[] = [
  'credit-transactions',
  'sell-requests',
  'batches',
  'setup-items',
  'media',
  'users',
  'sites',
]

const already = await payload.count({ collection: 'sites' })
if (already.totalDocs > 0) {
  if (process.env.SEED_RESET !== 'true') {
    payload.logger.info('Database already has data — run with SEED_RESET=true to wipe and reseed.')
    process.exit(0)
  }
  payload.logger.info('SEED_RESET=true — deleting existing demo data…')
  for (const collection of WIPE) await payload.delete({ collection, where: { id: { exists: true } } })
}

/** dd/mm/yyyy → ISO, at local noon. */
const d = (s: string) => {
  const [day, month, year] = s.split('/').map(Number)
  return new Date(year, month - 1, day, 12).toISOString()
}
const moisture = (values: number[]) => values.map((value) => ({ value }))

payload.logger.info('Seeding settings…')
await payload.updateGlobal({
  slug: 'settings',
  data: {
    creditFactor: 0.1,
    creditPrice: 150000,
    creditGoal: 1000,
    maxMoisture: 15,
    defaultBuyer: 'PT Hijau Karbon (sample)',
  },
})

payload.logger.info('Seeding sites…')
const [pasaman] = await Promise.all(
  ['Pasaman Barat', 'Solok Selatan', 'Agam'].map((name) =>
    payload.create({ collection: 'sites', data: { name, region: 'Sumatera Barat' } }),
  ),
)

payload.logger.info('Seeding users…')
await payload.create({
  collection: 'users',
  data: { name: 'Admin', username: 'admin', role: 'admin', password: adminPassword },
})

const supervisor = async (name: string, phone: string, village: string, en: string, id: string, email?: string) => {
  const user = await payload.create({
    collection: 'users',
    locale: 'en',
    data: {
      name,
      phone,
      username: phoneToUsername(phone),
      village,
      email,
      role: 'supervisor',
      site: pasaman.id,
      jobTitle: en,
      password: pin,
    },
  })
  await payload.update({ collection: 'users', id: user.id, locale: 'id', data: { jobTitle: id } })
  return user
}
const sari = await supervisor(
  'Ibu Sari Wulandari',
  '+62 812-7710-2291',
  'Simpang Empat, Pasaman Barat',
  'Lead supervisor',
  'Supervisor utama',
  'sari@example.com',
)
await supervisor(
  'Pak Budi Hartono',
  '+62 813-5520-8814',
  'Simpang Empat, Pasaman Barat',
  'Field supervisor',
  'Supervisor lapangan',
)
const andi = await payload.create({
  collection: 'users',
  data: {
    name: 'Pak Andi Saputra',
    phone: '+62 812-0000-0000',
    username: phoneToUsername('+62 812-0000-0000'),
    village: 'Nagari Air Bangis, Pasaman Barat',
    role: 'worker',
    site: pasaman.id,
    password: pin,
  },
})

payload.logger.info('Seeding site setup…')
const SETUP: Record<string, string[]> = {
  kilns: ['Masri Malay 5', 'Masri Malay 6', 'Masri Malay 7'],
  sources: ['Pak Masri Malay', 'Pasaman Barat Farms'],
  farmers: ['Pak Fitra KP Hidup Basamo · 813-6394-5159'],
  vehicles: ['Pickup · BA 8841 KT (sample)'],
  bioref: ['Corn Cob', 'Wood waste', 'Patchouli waste'],
  measure: ['Bucket · 20 L', 'Drum · 200 L'],
  sample: ['Jar · 1 L'],
  bags: ['Karung standard · 40 kg'],
  crops: ['Corn', 'Rice', 'Chili'],
  buyers: ['PT Hijau Karbon (sample)'],
}
for (const [category, items] of Object.entries(SETUP)) {
  for (const item of items) {
    const [name, ...rest] = item.split(' · ')
    await payload.create({
      collection: 'setup-items',
      data: { category: category as never, name, detail: rest.join(' · '), site: pasaman.id, createdBy: andi.id },
    })
  }
}

payload.logger.info('Seeding batches…')
type BatchSeed = Omit<Batch, 'id' | 'createdAt' | 'updatedAt' | 'worker' | 'site' | 'sizes'>
const corn = (kg: number) => ({ biomassType: 'Corn Cob', quantity: kg, unit: 'kg' as const })
const reviewed = (date: string) => ({ reviewedBy: sari.id, reviewedAt: d(date) })

const batches: BatchSeed[] = [
  {
    code: 'B-2309',
    status: 'progress',
    day: 2,
    step: 3,
    startedAt: d('23/09/2026'),
    collect: { ...corn(898), source: 'Pak Masri Malay', transport: 'manual' },
    burn: {
      kiln: 'Masri Malay 5',
      moisture: moisture([7.4, 8.1, 6.9, 9.3, 8.8]),
      // Burn started 84 minutes ago, so the app's timer is live.
      startedAt: new Date(Date.now() - (84 * 60 + 10) * 1000).toISOString(),
    },
  },
  {
    code: 'B-1209-2',
    status: 'waiting',
    day: 3,
    step: 0,
    startedAt: d('12/09/2026'),
    collect: corn(792),
    burn: { kiln: 'Masri Malay 5', litres: 798, moisture: moisture([7.1, 8.2, 6.7, 9.2, 10]) },
  },
  {
    code: 'B-1209-1',
    status: 'waiting',
    day: 3,
    step: 0,
    startedAt: d('12/09/2026'),
    collect: corn(778),
    burn: { kiln: 'Masri Malay 5', litres: 776, moisture: moisture([8.0, 7.7, 9.1, 8.4, 7.9]) },
  },
  {
    code: 'B-1009',
    status: 'rejected',
    day: 3,
    step: 0,
    startedAt: d('10/09/2026'),
    collect: corn(810),
    burn: { kiln: 'Masri Malay 6', litres: 805, moisture: moisture([9.8, 10.4, 8.7, 11.0, 9.5]) },
    review: { ...reviewed('11/09/2026'), rejectReason: 'quench', rejectNote: 'Please take a new one.' },
  },
  {
    code: 'B-0509',
    status: 'approved',
    day: 3,
    step: 0,
    startedAt: d('05/09/2026'),
    collect: { biomassType: 'Wood waste', quantity: 640, unit: 'kg' },
    burn: { kiln: 'Masri Malay 7', litres: 612, moisture: moisture([11.2, 12.0, 10.8, 11.5, 12.4]) },
    review: reviewed('07/09/2026'),
  },
  {
    code: 'B-2806',
    status: 'done',
    day: 5,
    step: 0,
    startedAt: d('28/06/2026'),
    collect: corn(760),
    burn: { kiln: 'Masri Malay 5', litres: 740 },
    review: reviewed('30/06/2026'),
  },
]
// Approved/done batches create their own "earned" ledger rows (creditOnApproval hook).
for (const data of batches) {
  await payload.create({ collection: 'batches', data: { ...data, worker: andi.id, site: pasaman.id } })
}

payload.logger.info('Seeding credits history…')
const ledger = async (type: 'earned' | 'sold', amount: number, date: string, en: string, id: string) => {
  const tx = await payload.create({
    collection: 'credit-transactions',
    locale: 'en',
    data: { worker: andi.id, type, amount, date: d(date), title: en },
  })
  await payload.update({ collection: 'credit-transactions', id: tx.id, locale: 'id', data: { title: id } })
}
await ledger('earned', 1644.8, '04/05/2026', '12 corn cob batches approved', '12 batch tongkol jagung disetujui')
await ledger(
  'sold',
  -1000,
  '15/05/2026',
  'Sold to PT Hijau Karbon (sample) · Rp 150 million',
  'Dijual ke PT Hijau Karbon (contoh) · Rp 150 juta',
)

payload.logger.info('Done. Sign in to /admin with username "admin" and your SEED_ADMIN_PASSWORD.')
process.exit(0)
