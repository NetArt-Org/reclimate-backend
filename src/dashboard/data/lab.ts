/** Lab reports for feedstocks (shared by the admin pages and the server). */

/** A new bulk-density report is due after this much biochar (m³) from the feedstock at the network. */
export const BULK_DENSITY_EVERY_M3 = 100
/** A full lab analysis is due once a year. */
export const ANALYSIS_EVERY_DAYS = 365

export type LabKind = 'bulk-density' | 'analysis'

/** The values a lab analysis reports (in %, except pH, H/C ratio and bulk density). */
export const ANALYSIS_FIELDS = [
  { key: 'carbonTotal', label: 'Total carbon', unit: '%' },
  { key: 'carbonOrganic', label: 'Organic carbon', unit: '%' },
  { key: 'carbonInorganic', label: 'Inorganic carbon', unit: '%' },
  { key: 'hydrogen', label: 'Hydrogen', unit: '%' },
  { key: 'hcRatio', label: 'H/C ratio', unit: '' },
  { key: 'ash', label: 'Ash content', unit: '%' },
  { key: 'ph', label: 'pH', unit: '' },
  { key: 'waterHoldingCapacity', label: 'Water holding capacity', unit: '%' },
  { key: 'nitrogen', label: 'Nitrogen', unit: '%' },
  { key: 'sulphur', label: 'Sulphur', unit: '%' },
  { key: 'fixedCarbon', label: 'Fixed carbon', unit: '%' },
] as const
export type AnalysisKey = (typeof ANALYSIS_FIELDS)[number]['key']
/** The minimum the registry asks for in an analysis. */
export const REQUIRED_ANALYSIS: AnalysisKey[] = ['carbonTotal', 'carbonOrganic', 'hydrogen', 'hcRatio', 'ash', 'ph', 'waterHoldingCapacity']

export interface LabReport {
  id: string
  kind: LabKind
  networkId: string
  reportDate: string
  bulkDensity: number | null
  values: Partial<Record<AnalysisKey, number | null>>
  producedM3: number | null
  note: string
  uploadedBy: string
  file: { id: string; name: string; size: number } | null
}

/** Where one network stands with one feedstock's lab reports. */
export interface LabStatus {
  networkId: string
  feedstock: string
  /** Biochar made from the feedstock at the network so far (m³). */
  producedM3: number
  /** …since the last bulk-density report (all of it when there is none). */
  sinceBulkDensityM3: number
  bulkDensityDue: boolean
  lastBulkDensity: { date: string; value: number | null } | null
  lastAnalysis: { date: string } | null
  analysisDue: boolean
}

