/**
 * Dashboard data model. Shaped so each type maps onto a Payload collection
 * later (orgs, networks, sites, kilns, users, production, alerts, logs).
 */

export type NetworkType = 'artisan' | 'csink'
export type Role = 'manager' | 'supervisor' | 'operator' | 'farmer'

/** Someone listed on a company or organisation (admin, billing or ICS contact). */
export interface Contact {
  id: string
  name: string
  role: string
  email?: string
  phone?: string
}

export interface PartnerOrg {
  id: string
  name: string
  code: string
  active: boolean
  address?: string
  admins?: Contact[]
  /** Organisation-wide standards (networks can narrow them). */
  standards?: { mixingTypes: string[]; applicationTypes: string[]; references: FeedstockReference[] }
}

export type FeedstockStrategy = 'avoidance' | 'compensation' | null

export interface PortfolioFeedstock {
  name: string
  /** Methane strategy for the feedstock's baseline. */
  strategy: FeedstockStrategy
  /** Has a site-specific carbon (SPC) value. */
  spc: boolean
}

/** Field-app rules for one kind of network (or the company default). */
export interface AppConfig {
  moisture: { required: boolean; max: number }
  temperature: { required: boolean; min: number; readings: number }
  minFiringImages: number
  recordVideo: boolean
  minVideoSeconds: number
  canApplyOpenBiochar: boolean
  hideMixingTab: boolean
  quenchSteps: string[]
}
export type AppConfigScope = 'artisan' | 'csink' | 'company'

export interface Project {
  id: string
  name: string
  registry: string
  status: 'draft' | 'validation' | 'validated' | 'registered'
  networkIds: string[]
  createdAt: string
}

export interface Certificate {
  id: string
  companyName: string
  email: string
  phone: string
  issuer: string
  number: string
  validFrom: string
  validTo: string
}

export interface AuditEntry {
  id: string
  at: string
  by: string
  change: string
}

/** The C-sink manager company that owns this workspace. */
export interface Company {
  name: string
  kind: string
  address: string
  email: string
  phone: string
  admins: Contact[]
  billingManagers: Contact[]
  billingDocs: DocFile[]
  icsManagers: Contact[]
  documents: DocFile[]
  services: { afforestation: boolean; iot: boolean }
  feedstocks: PortfolioFeedstock[]
  mixingTypes: string[]
  applicationTypes: string[]
  approvedNetworkIds: string[]
  references: FeedstockReference[]
  appConfig: Record<AppConfigScope, AppConfig>
  /** A change to the field-app rules waiting for approval. */
  pendingAppConfig?: { scope: AppConfigScope; config: AppConfig; by: string; at: string }
  audit: AuditEntry[]
  projects: Project[]
  certificates: Certificate[]
}

/** A file kept with a record: SOP documents, training certificates, KML. */
export interface DocFile {
  id: string
  name: string
  size: number
  type: string
  /** Small images are kept as data URLs so they survive a reload. */
  url?: string
  addedAt: string
}

export interface PreprocessStep {
  method: 'machine' | 'sun' | 'manual'
  description: string
  documents: DocFile[]
}

/** Lab reference values for one feedstock. */
export interface FeedstockReference {
  feedstock: string
  /** kg/m³ */
  bulkDensity: number
  /** % */
  moisture: number
  /** % */
  carbonContent: number
}

export interface NetworkConfig {
  feedstocks: string[]
  mixingTypes: string[]
  applicationTypes: string[]
  drying?: PreprocessStep
  shredding?: PreprocessStep
  references: FeedstockReference[]
}

export interface KmlBoundary {
  fileName: string
  uploadedAt: string
  placemarks: number
  /** [lat, lng] rings */
  polygons: [number, number][][]
}

/** An "entity" on My Networks: an Artisan Pro network (kilns) or a C-sink network (farmers). */
export interface Network {
  id: string
  orgId: string
  type: NetworkType
  name: string
  location: string
  lat: number
  lng: number
  active: boolean
  /** Approved under the CERES certificate. */
  ceresApproved: boolean
  /** Credits before this date are not eligible when "Cut-off date" is on. */
  certifiedAt?: string
  config: NetworkConfig
  kml?: KmlBoundary
}

export interface Site {
  id: string
  networkId: string
  name: string
  lat: number
  lng: number
  active: boolean
}

export interface Kiln {
  id: string
  siteId: string
  name: string
  lat: number
  lng: number
  active: boolean
}

export interface Device {
  model: string
  app: 'online' | 'offline'
  version: string
  lastSeen: string
}

export interface User {
  id: string
  name: string
  role: Role
  email?: string
  phone: string
  orgId: string
  networkIds: string[]
  siteIds: string[]
  active: boolean
  /** Can sign in without an SMS code (field staff with poor signal). */
  otpBypass: boolean
  photo?: string
  trainingDocs: DocFile[]
  device?: Device
  /** Farmers are shown on the map. */
  lat?: number
  lng?: number
}

/** Production per site per week (in the backend this is summed from batches). */
export interface Production {
  /** Monday of the week, YYYY-MM-DD */
  week: string
  /** YYYY-MM of that Monday — used by month filters */
  month: string
  networkId: string
  siteId: string
  biomassT: number
  biocharT: number
  co2T: number
  creditsT: number
}

export interface Alert {
  id: string
  kind: 'bulk-density' | 'certificate' | 'kiln'
  message: string
  date: string
  networkId?: string
  /** For bulk-density requests: the change being asked for. */
  request?: { feedstock: string; bulkDensity: number; by: string }
  status: 'open' | 'approved' | 'rejected' | 'dismissed'
}

export interface LogEntry {
  id: string
  message: string
  date: string
  networkId?: string
}

export interface DashboardData {
  company: Company
  orgs: PartnerOrg[]
  networks: Network[]
  sites: Site[]
  kilns: Kiln[]
  users: User[]
  production: Production[]
  alerts: Alert[]
  logs: LogEntry[]
}

export type PeriodKind = 'all' | 'month' | 'year' | 'custom'

export interface Filters {
  orgId: string | null
  /** null = both kinds */
  networkType: NetworkType | null
  networkIds: string[]
  siteIds: string[]
  cutoff: boolean
  vintages: number[]
  period: { kind: PeriodKind; from?: string; to?: string }
}
