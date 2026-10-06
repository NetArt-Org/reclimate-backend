import type { AppConfig, Feedstock, NetworkType, Role } from './types'

/** Newest version of the field app; devices on anything older raise an alert. */
export const LATEST_APP_VERSION = '2.7.0'

export const MIXING_TYPES = [
  'Biochar-Compost (1:1)',
  'Biochar-Solid Manure',
  'Biochar only',
  'Biochar-based fertilizer',
  'Biochar-biostimulant',
]

export const APPLICATION_TYPES = ['Agricultural soil', 'Horticulture', 'Agroforestry', 'Landscaping']

/** Starting reference values for a feedstock: its lab values in Settings → Feedstock management. */
export const referenceDefaults = (feedstocks: Feedstock[], name: string) => {
  const f = feedstocks.find((x) => x.name === name)
  return { bulkDensity: f?.bulkDensity ?? 0, carbonContent: f?.carbonContent ?? 0 }
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
