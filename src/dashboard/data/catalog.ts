import type { AppConfig, NetworkType, Role } from './types'

/** Newest version of the field app; devices on anything older raise an alert. */
export const LATEST_APP_VERSION = '2.7.0'

export const FEEDSTOCKS = [
  'Rice stalk',
  'Coconut shell',
  'Wood waste',
  'Cotton stalk',
  'Corn cob',
  'Canarium shell',
  'Coconut husk',
  'Patchouli waste',
  'Empty fruit bunch',
  'Wood waste (rubber)',
  'Lemon myrtle',
]

export const MIXING_TYPES = [
  'Biochar only',
  'Biochar-based fertilizer',
  'Biochar-compost (1:1)',
  'Biochar-compost (free)',
  'Biochar-biostimulant',
]

export const APPLICATION_TYPES = ['Agricultural soil', 'Horticulture', 'Agroforestry', 'Landscaping']

/** Typical lab values, used as defaults when a feedstock is first referenced. */
export const REFERENCE_DEFAULTS: Record<string, { bulkDensity: number; moisture: number; carbonContent: number }> = {
  'Rice stalk': { bulkDensity: 110, moisture: 12, carbonContent: 38 },
  'Coconut shell': { bulkDensity: 520, moisture: 10, carbonContent: 50 },
  'Wood waste': { bulkDensity: 240, moisture: 18, carbonContent: 48 },
  'Cotton stalk': { bulkDensity: 160, moisture: 14, carbonContent: 44 },
  'Corn cob': { bulkDensity: 180, moisture: 13, carbonContent: 46 },
  'Canarium shell': { bulkDensity: 480, moisture: 11, carbonContent: 49 },
  'Coconut husk': { bulkDensity: 130, moisture: 15, carbonContent: 45 },
  'Patchouli waste': { bulkDensity: 150, moisture: 16, carbonContent: 42 },
  'Empty fruit bunch': { bulkDensity: 140, moisture: 20, carbonContent: 43 },
  'Wood waste (rubber)': { bulkDensity: 260, moisture: 17, carbonContent: 47 },
  'Lemon myrtle': { bulkDensity: 170, moisture: 14, carbonContent: 44 },
}

export const NETWORK_TYPE_LABEL: Record<NetworkType, string> = {
  artisan: 'Artisan Pro',
  csink: 'C-sink Network',
}

export const ROLE_LABEL: Record<Role, string> = {
  manager: 'Manager',
  supervisor: 'Supervisor',
  operator: 'Kiln operator',
  farmer: 'Farmer',
}

/** "Promote" moves a person one step up. */
export const ROLE_ORDER: Role[] = ['farmer', 'operator', 'supervisor', 'manager']

export const DEFAULT_APP_CONFIG: AppConfig = {
  moisture: { required: true, max: 20 },
  temperature: { required: true, min: 650, readings: 1 },
  minFiringImages: 3,
  recordVideo: true,
  minVideoSeconds: 20,
  canApplyOpenBiochar: false,
  hideMixingTab: false,
  quenchSteps: ['Pre-quench', 'Quenching'],
}

export const QUENCH_STEPS = ['Pre-quench', 'Quenching', 'Post-quench', 'Drying']
export const REGISTRIES = ['CSI (C-Sink 1000+)', 'Puro.earth', 'Verra', 'Isometric']
