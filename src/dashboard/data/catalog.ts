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
  moisture: { required: true, max: 20, readings: 5 },
  temperature: { required: true, min: 650, readings: 1 },
  minFiringImages: 3,
  recordVideo: true,
  minFiringVideos: 1,
  minVideoSeconds: 20,
  canApplyOpenBiochar: false,
  hideMixingTab: false,
  quenchSteps: ['Pre-quench', 'Quenching'],
  photos: { biomass: 2, mixing: 2, packing: 1, application: 2 },
  credits: { price: 150000, currency: 'IDR', payoutGoal: 1000 },
  supportPhone: '',
}

/** Stored settings may predate newer options: fill anything missing from the defaults. */
export function withAppDefaults(c?: Partial<AppConfig> | null): AppConfig {
  const d = DEFAULT_APP_CONFIG
  return {
    ...d,
    ...c,
    moisture: { ...d.moisture, ...c?.moisture },
    temperature: { ...d.temperature, ...c?.temperature },
    photos: { ...d.photos, ...c?.photos },
    credits: { ...d.credits, ...c?.credits },
    quenchSteps: c?.quenchSteps ?? d.quenchSteps,
  }
}

/**
 * Reasons a supervisor can give when rejecting a batch, and which evidence the worker must capture again
 * (`redo` is the field-app slot that is cleared). Kept here so every app shows the same list.
 */
export const REJECT_REASONS = [
  { key: 'quench', label: 'Quench photo is blurry', redo: 'quench' },
  { key: 'fire', label: 'Firing photos are not clear', redo: 'firePh' },
  { key: 'video', label: 'Firing videos are too short', redo: 'fireVid' },
  { key: 'moist', label: 'Moisture photos do not match the numbers', redo: 'moist' },
  { key: 'qty', label: 'Biochar amount looks wrong', redo: 'litres' },
  { key: 'temp', label: 'Temperature reading is missing or wrong', redo: 'temp' },
]

export const QUENCH_STEPS = ['Pre-quench', 'Quenching', 'Post-quench', 'Drying']
export const REGISTRIES = ['CSI (C-Sink 1000+)', 'Puro.earth', 'Verra', 'Isometric']
