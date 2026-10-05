import { DEFAULT_APP_CONFIG, REFERENCE_DEFAULTS } from './catalog'
import type {
  Alert, Company, DashboardData, Kiln, LogEntry, Network, NetworkConfig, PartnerOrg, Production, Site, User,
} from './types'

/**
 * Demo data for building the dashboard before it is wired to Neon.
 * Everything here is invented — organisations, people, emails and phone
 * numbers (555 numbers, example.com) are placeholders.
 * Generation is deterministic so the server and browser render the same thing.
 */

function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Every month from Jan 2024 to the current month, as YYYY-MM. */
export function monthRange(from = '2024-01', to?: string) {
  const now = new Date()
  const end = to ?? `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
  const out: string[] = []
  let [y, m] = from.split('-').map(Number)
  for (;;) {
    const key = `${y}-${pad(m)}`
    out.push(key)
    if (key >= end) break
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return out
}

/** Monday (local) of the week containing `d`, as YYYY-MM-DD. */
export function weekStart(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
}

/** Every week (its Monday) from the first week of 2024 to the current week. */
export function weekRange(from = '2024-01-01') {
  const out: string[] = []
  const end = weekStart(new Date())
  const d = new Date(`${from}T00:00:00`)
  for (let key = weekStart(d); key <= end; ) {
    out.push(key)
    d.setDate(d.getDate() + 7)
    key = weekStart(d)
  }
  return out
}

const cfg = (feedstocks: string[], mixingTypes: string[], extra: Partial<NetworkConfig> = {}): NetworkConfig => ({
  feedstocks,
  mixingTypes,
  applicationTypes: ['Agricultural soil'],
  references: feedstocks.map((f) => ({ feedstock: f, ...REFERENCE_DEFAULTS[f] })),
  ...extra,
})

const ALL_MIX_TYPES = ['Biochar only', 'Biochar-based fertilizer', 'Biochar-compost (1:1)', 'Biochar-compost (free)', 'Biochar-biostimulant']

const orgs: PartnerOrg[] = [
  {
    id: 'org-id01', name: 'Nusantara Biochar Cooperative', code: 'ID01', active: true, address: 'Simpang Empat, West Pasaman Regency, Indonesia',
    admins: [{ id: 'c-o1', name: 'Budi Santoso', role: 'Organisation admin', email: 'budi@example.com', phone: '+62 812-555-0109' }],
    standards: { mixingTypes: ALL_MIX_TYPES, applicationTypes: ['Agricultural soil'], references: [] },
  },
  {
    id: 'org-staf', name: 'St Anne Agro Works', code: 'STAF', active: false, address: 'Butterworth, Penang, Malaysia',
    admins: [], standards: { mixingTypes: ['Biochar only'], applicationTypes: ['Agricultural soil'], references: [] },
  },
  {
    id: 'org-my01', name: 'Reclimate Solutions', code: 'MY01', active: true, address: 'Suite 6.01, Level 6, Jalan Ampang, Kuala Lumpur, Malaysia',
    admins: [{ id: 'c-o2', name: 'Farah Lim', role: 'Organisation admin', email: 'farah@example.com', phone: '+60 12-555 0101' }],
    standards: { mixingTypes: ALL_MIX_TYPES.slice(0, 3), applicationTypes: ['Agricultural soil'], references: [] },
  },
]

const ALL_MIX = ['Biochar only', 'Biochar-based fertilizer', 'Biochar-compost (1:1)', 'Biochar-compost (free)', 'Biochar-biostimulant']

const networks: Network[] = [
  {
    id: 'net-selangor', orgId: 'org-my01', type: 'artisan', name: 'Selangor Biochar Hub', location: 'Shah Alam, Selangor',
    lat: 3.073, lng: 101.518, active: true, ceresApproved: true, certifiedAt: '2025-03-01',
    config: cfg(['Wood waste', 'Coconut shell'], ['Biochar only', 'Biochar-compost (1:1)'], {
      drying: { method: 'sun', description: 'Spread on tarpaulin for 3 sunny days, turned twice a day.', documents: [] },
    }),
  },
  {
    id: 'net-pelangi', orgId: 'org-my01', type: 'artisan', name: 'Pelangi Agro Collective', location: 'Kudat, Sabah',
    lat: 6.885, lng: 116.85, active: true, ceresApproved: true, certifiedAt: '2025-06-15',
    config: cfg(['Coconut husk', 'Wood waste'], ALL_MIX.slice(0, 3)),
  },
  {
    id: 'net-marak', orgId: 'org-my01', type: 'artisan', name: 'Marak Parak Kiln Group', location: 'Marak Parak, Sabah',
    lat: 6.33, lng: 116.74, active: true, ceresApproved: true, certifiedAt: '2025-01-10',
    config: cfg(['Wood waste', 'Lemon myrtle'], ALL_MIX),
  },
  {
    id: 'net-kedah', orgId: 'org-my01', type: 'csink', name: 'Kedah Rice Growers', location: 'Alor Setar, Kedah',
    lat: 6.121, lng: 100.367, active: false, ceresApproved: false,
    config: cfg(['Rice stalk'], ['Biochar-compost (free)']),
  },
  {
    id: 'net-pasaman', orgId: 'org-id01', type: 'artisan', name: 'Pasaman Barat Artisans', location: 'Simpang Empat, West Sumatra',
    lat: 0.221, lng: 99.641, active: true, ceresApproved: true, certifiedAt: '2024-09-01',
    config: cfg(['Corn cob', 'Wood waste', 'Patchouli waste'], ALL_MIX, {
      shredding: { method: 'machine', description: 'Hammer mill to under 5 cm before drying.', documents: [] },
    }),
  },
  {
    id: 'net-blora', orgId: 'org-id01', type: 'artisan', name: 'Blora Biochar Works', location: 'Randublatung, Blora',
    lat: -7.1, lng: 111.4, active: true, ceresApproved: true, certifiedAt: '2025-08-01',
    config: cfg(['Corn cob'], ['Biochar only', 'Biochar-biostimulant', 'Biochar-based fertilizer']),
  },
  {
    id: 'net-pasuruan', orgId: 'org-id01', type: 'artisan', name: 'Pasuruan Corn Collective', location: 'Sukorejo, Pasuruan',
    lat: -7.71, lng: 112.71, active: true, ceresApproved: false,
    config: cfg(['Corn cob'], ALL_MIX.slice(0, 2)),
  },
  {
    id: 'net-lombok', orgId: 'org-id01', type: 'csink', name: 'Lombok Farmer Network', location: 'Central Lombok, NTB',
    lat: -8.69, lng: 116.27, active: true, ceresApproved: true, certifiedAt: '2025-11-01',
    config: cfg(['Corn cob', 'Rice stalk'], ['Biochar-compost (1:1)', 'Biochar-compost (free)']),
  },
  {
    id: 'net-stanne', orgId: 'org-staf', type: 'artisan', name: 'St Anne Kiln Park', location: 'Butterworth, Penang',
    lat: 5.399, lng: 100.364, active: false, ceresApproved: false,
    config: cfg(['Coconut shell'], ['Biochar only']),
  },
]

const site = (id: string, networkId: string, name: string, lat: number, lng: number, active = true): Site => ({
  id, networkId, name, lat, lng, active,
})

const sites: Site[] = [
  site('site-shahalam', 'net-selangor', 'Shah Alam Yard', 3.08, 101.53),
  site('site-klang', 'net-selangor', 'Klang Riverside', 3.04, 101.45),
  site('site-kudat', 'net-pelangi', 'Kudat Cassava Hub', 6.89, 116.84),
  site('site-marak', 'net-marak', 'Marak Parak Farm', 6.32, 116.75),
  site('site-tengi', 'net-marak', 'Sungai Tengi', 6.36, 116.7),
  site('site-alorsetar', 'net-kedah', 'Kedah Rice Valley', 6.12, 100.37, false),
  site('site-pasaman', 'net-pasaman', 'Pasaman Barat', 0.22, 99.64),
  site('site-airbangis', 'net-pasaman', 'Air Bangis', 0.2, 99.38),
  site('site-blora', 'net-blora', 'Mojokerto Kiln Yard', -7.08, 111.42),
  site('site-pasuruan', 'net-pasuruan', 'Pasuruan Fields', -7.72, 112.72),
  site('site-lombok', 'net-lombok', 'Praya Fields', -8.7, 116.27),
  site('site-stanne', 'net-stanne', 'Butterworth Yard', 5.4, 100.37, false),
]

const r = rng(42)
const kilns: Kiln[] = sites
  .filter((s) => networks.find((n) => n.id === s.networkId)?.type === 'artisan')
  .flatMap((s, si) =>
    Array.from({ length: 2 + (si % 4) }, (_, i) => ({
      id: `kiln-${s.id}-${i + 1}`,
      siteId: s.id,
      name: `Kontiki ${i + 1}`,
      lat: s.lat + (r() - 0.5) * 0.04,
      lng: s.lng + (r() - 0.5) * 0.04,
      active: s.active && r() > 0.12,
    })),
  )

const recent = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString()

const person = (
  id: string, name: string, role: User['role'], orgId: string, networkIds: string[], siteIds: string[],
  phone: string, extra: Partial<User> = {},
): User => ({
  id, name, role, orgId, networkIds, siteIds, phone, active: true, otpBypass: false, trainingDocs: [],
  email: role === 'manager' ? `${name.split(' ')[0].toLowerCase()}@example.com` : undefined,
  device: role === 'manager' ? undefined : { model: 'Redmi Note 12', app: 'online', version: '2.7.0', lastSeen: recent(1) },
  ...extra,
})

const users: User[] = [
  person('u-1', 'Farah Lim', 'manager', 'org-my01', ['net-selangor', 'net-kedah'], [], '+60 12-555 0101'),
  person('u-2', 'Arif Rahman', 'supervisor', 'org-my01', ['net-selangor'], ['site-shahalam', 'site-klang'], '+60 12-555 0102', {
    otpBypass: true, device: { model: 'Galaxy A14', app: 'online', version: '2.6.3', lastSeen: recent(2) },
  }),
  person('u-3', 'Hafiz Omar', 'operator', 'org-my01', ['net-selangor'], ['site-shahalam'], '+60 12-555 0103'),
  person('u-4', 'Maya Tan', 'manager', 'org-my01', ['net-pelangi'], [], '+60 12-555 0104'),
  person('u-5', 'Daniel Ong', 'supervisor', 'org-my01', ['net-pelangi'], ['site-kudat'], '+60 12-555 0105', {
    device: { model: 'Redmi 10C', app: 'offline', version: '2.5.1', lastSeen: recent(9) },
  }),
  person('u-6', 'Lina Wong', 'manager', 'org-my01', ['net-marak'], [], '+60 12-555 0106'),
  person('u-7', 'Yusuf Ismail', 'supervisor', 'org-my01', ['net-marak'], ['site-marak', 'site-tengi'], '+60 12-555 0107'),
  person('u-8', 'Kevin Lee', 'operator', 'org-my01', ['net-marak'], ['site-tengi'], '+60 12-555 0108', {
    device: { model: 'Galaxy A05', app: 'online', version: '2.6.3', lastSeen: recent(3) },
  }),
  person('u-9', 'Budi Santoso', 'manager', 'org-id01', ['net-pasaman', 'net-blora'], [], '+62 812-555-0109'),
  person('u-10', 'Siti Rahma', 'supervisor', 'org-id01', ['net-pasaman'], ['site-pasaman', 'site-airbangis'], '+62 812-555-0110', { otpBypass: true }),
  person('u-11', 'Rizal Hakim', 'operator', 'org-id01', ['net-pasaman'], ['site-pasaman'], '+62 812-555-0111'),
  person('u-12', 'Dewi Lestari', 'supervisor', 'org-id01', ['net-blora'], ['site-blora'], '+62 812-555-0112'),
  person('u-13', 'Joko Susilo', 'operator', 'org-id01', ['net-blora'], ['site-blora'], '+62 812-555-0113', {
    device: { model: 'Redmi 9A', app: 'online', version: '2.6.0', lastSeen: recent(4) },
  }),
  person('u-14', 'Hendra Wijaya', 'manager', 'org-id01', ['net-pasuruan'], [], '+62 812-555-0114'),
  person('u-15', 'Bayu Pratama', 'supervisor', 'org-id01', ['net-pasuruan'], ['site-pasuruan'], '+62 812-555-0115'),
  person('u-16', 'Intan Permata', 'manager', 'org-id01', ['net-lombok'], [], '+62 812-555-0116'),
  person('u-17', 'Agus Salim', 'farmer', 'org-id01', ['net-lombok'], ['site-lombok'], '+62 812-555-0117', { lat: -8.68, lng: 116.25 }),
  person('u-18', 'Wati Suryani', 'farmer', 'org-id01', ['net-lombok'], ['site-lombok'], '+62 812-555-0118', { lat: -8.72, lng: 116.3 }),
  person('u-19', 'Putri Ayu', 'farmer', 'org-id01', ['net-lombok'], ['site-lombok'], '+62 812-555-0119', { lat: -8.66, lng: 116.31, active: false }),
  person('u-20', 'Sari Indah', 'farmer', 'org-my01', ['net-kedah'], ['site-alorsetar'], '+60 12-555 0120', { lat: 6.14, lng: 100.4 }),
  person('u-21', 'Ahmad Fauzi', 'farmer', 'org-my01', ['net-kedah'], ['site-alorsetar'], '+60 12-555 0121', { lat: 6.1, lng: 100.33 }),
  person('u-22', 'Nur Aisyah', 'supervisor', 'org-staf', ['net-stanne'], ['site-stanne'], '+60 12-555 0122', { active: false }),
  person('u-23', 'Rina Kartika', 'operator', 'org-id01', ['net-pasaman'], ['site-airbangis'], '+62 812-555-0123'),
  person('u-24', 'Ayu Wulandari', 'operator', 'org-my01', ['net-pelangi'], ['site-kudat'], '+60 12-555 0124'),
]

/* ---- monthly production per site: each network ramps up at its own time ---- */

const START: Record<string, string> = {
  'net-pasaman': '2024-03', 'net-marak': '2024-06', 'net-selangor': '2024-09', 'net-pelangi': '2025-02',
  'net-blora': '2025-05', 'net-pasuruan': '2025-09', 'net-lombok': '2025-07', 'net-kedah': '2024-05', 'net-stanne': '2024-02',
}
const END: Record<string, string> = { 'net-kedah': '2025-04', 'net-stanne': '2024-11' }

const pr = rng(7)
const production: Production[] = []
for (const week of weekRange()) {
  const month = week.slice(0, 7)
  const mm = Number(week.slice(5, 7))
  // Dry-season months burn more.
  const season = 0.75 + 0.5 * Math.max(0, Math.sin(((mm - 3) / 12) * Math.PI * 2))
  for (const s of sites) {
    const start = START[s.networkId]
    const end = END[s.networkId]
    if (month < start || (end && month > end)) continue
    const net = networks.find((n) => n.id === s.networkId)!
    const base = net.type === 'csink' ? 2.1 : 5.1
    const biomassT = +(base * season * (0.5 + pr())).toFixed(2)
    const biocharT = +(biomassT * (0.22 + pr() * 0.06)).toFixed(3)
    const co2T = +(biocharT * 2.3).toFixed(3)
    production.push({ week, month, networkId: s.networkId, siteId: s.id, biomassT, biocharT, co2T, creditsT: +(co2T * 0.74).toFixed(3) })
  }
}

const alerts: Alert[] = [
  {
    id: 'al-1', kind: 'bulk-density', networkId: 'net-marak', date: recent(1), status: 'open',
    message: 'Bulk-density update requested for Wood waste in Marak Parak Kiln Group',
    request: { feedstock: 'Wood waste', bulkDensity: 268, by: 'Yusuf Ismail' },
  },
  {
    id: 'al-2', kind: 'certificate', networkId: 'net-pasuruan', date: recent(3), status: 'open',
    message: 'Pasuruan Corn Collective is producing without a CERES approval — its credits are not eligible yet',
  },
  {
    id: 'al-3', kind: 'kiln', networkId: 'net-pasaman', date: recent(5), status: 'open',
    message: 'Kontiki 2 at Air Bangis has not reported a burn for 14 days',
  },
]

const lr = rng(99)
const operators = users.filter((u) => u.role === 'operator' || u.role === 'supervisor')
const logs: LogEntry[] = Array.from({ length: 14 }, (_, i) => {
  const k = kilns[Math.floor(lr() * kilns.length)]
  const s = sites.find((x) => x.id === k.siteId)!
  const n = networks.find((x) => x.id === s.networkId)!
  const o = orgs.find((x) => x.id === n.orgId)!
  const by = operators.find((u) => u.networkIds.includes(n.id))?.name ?? 'a field operator'
  const kg = Math.round(600 + lr() * 400)
  const feed = n.config.feedstocks[0]
  const kind = lr()
  const message =
    kind < 0.5
      ? `${kg} kg of ${feed} biomass was recorded at ${k.name}, ${s.name} for ${n.name} (${o.code}) by ${by}`
      : kind < 0.8
        ? `${Math.round(kg * 0.25)} L of biochar from ${k.name}, ${s.name} was approved for ${n.name}`
        : `${Math.round(lr() * 12) + 2} bags of biochar were applied to fields by ${n.name}`
  return { id: `log-${i}`, message, date: recent(i * 0.7 + lr() * 0.5), networkId: n.id }
}).sort((a, b) => b.date.localeCompare(a.date))

const company: Company = {
  name: 'Reclimate Pte Ltd',
  kind: 'C-sink manager',
  address: '63 Jalan Ampang, 50100 Kuala Lumpur, Malaysia',
  email: 'hello@example.com',
  phone: '+60 3-555 0100',
  admins: [
    { id: 'c-a1', name: 'Reclimate Pte Ltd', role: 'Company admin', email: 'hello@example.com' },
    { id: 'c-a2', name: 'Anita Rao', role: 'Company admin', email: 'anita@example.com' },
    { id: 'c-a3', name: 'Yusof Karim', role: 'Company admin', email: 'yusof@example.com' },
  ],
  billingManagers: [{ id: 'c-b1', name: 'Reclimate Pte Ltd', role: 'Billing manager', email: 'billing@example.com' }],
  billingDocs: [],
  icsManagers: [],
  documents: [{ id: 'doc-1', name: 'Artisan producers list.xlsx', size: 48200, type: 'application/vnd.ms-excel', addedAt: '2026-09-24T09:00:00.000Z' }],
  services: { afforestation: false, iot: false },
  feedstocks: [
    { name: 'Lemon myrtle', strategy: 'avoidance', spc: false },
    { name: 'Coconut shell', strategy: 'avoidance', spc: false },
    { name: 'Wood waste', strategy: 'compensation', spc: true },
    { name: 'Empty fruit bunch', strategy: null, spc: false },
    { name: 'Coconut husk', strategy: null, spc: false },
    { name: 'Corn cob', strategy: null, spc: false },
    { name: 'Patchouli waste', strategy: null, spc: false },
    { name: 'Wood waste (rubber)', strategy: null, spc: false },
  ],
  mixingTypes: ALL_MIX_TYPES,
  applicationTypes: ['Agricultural soil'],
  approvedNetworkIds: ['net-selangor', 'net-pelangi', 'net-marak', 'net-pasaman'],
  references: [],
  appConfig: {
    artisan: structuredClone(DEFAULT_APP_CONFIG),
    csink: { ...structuredClone(DEFAULT_APP_CONFIG), minFiringImages: 2, recordVideo: false, minVideoSeconds: 0 },
    company: structuredClone(DEFAULT_APP_CONFIG),
  },
  audit: [
    { id: 'au-1', at: '2026-06-09T11:04:00.000Z', by: 'Anita Rao', change: 'Artisan Pro: minimum video duration 15s → 20s' },
    { id: 'au-2', at: '2026-03-02T08:30:00.000Z', by: 'Yusof Karim', change: 'Artisan Pro: moisture limit 25% → 20%' },
  ],
  projects: [
    { id: 'pr-1', name: 'Sumatra artisan biochar 2025', registry: 'CSI (C-Sink 1000+)', status: 'registered', networkIds: ['net-pasaman'], createdAt: '2025-01-15T00:00:00.000Z' },
    { id: 'pr-2', name: 'Sabah kontiki programme', registry: 'CSI (C-Sink 1000+)', status: 'validation', networkIds: ['net-pelangi', 'net-marak'], createdAt: '2026-04-02T00:00:00.000Z' },
  ],
  certificates: [
    {
      id: 'ce-1', companyName: 'Reclimate Pte Ltd', email: 'hello@example.com', phone: '', issuer: 'Carbon Standards International',
      number: 'CSI-2025-0417', validFrom: '2025-03-01', validTo: '2027-02-28',
    },
  ],
}

export const createMockData = (): DashboardData => ({
  company: structuredClone(company),
  orgs: structuredClone(orgs),
  networks: structuredClone(networks),
  sites: structuredClone(sites),
  kilns: structuredClone(kilns),
  users: structuredClone(users),
  production: structuredClone(production),
  alerts: structuredClone(alerts),
  logs: structuredClone(logs),
})
