import { Ban, BadgeCheck, CircleDashed, Clock3, Hourglass, ShieldCheck, Trash2, type LucideIcon } from 'lucide-react'

import type { CreditBucket } from '../data/types'

/**
 * How each credit bucket is shown. Colors match the dashboard tokens (charts need literal values);
 * every bucket also has a label and an icon so meaning never rests on color alone.
 */
export const BUCKET_META: Record<CreditBucket, { label: string; help: string; color: string; icon: LucideIcon }> = {
  registered: {
    label: 'Registered',
    help: 'Issued on the registry.',
    color: '#23804d',
    icon: BadgeCheck,
  },
  pendingCirconomy: {
    label: 'Pending assessment',
    help: 'Recorded in the field, waiting for the dMRV (Circonomy) assessment.',
    color: '#2a64b8',
    icon: Hourglass,
  },
  pendingCeres: {
    label: 'Pending CERES',
    help: 'Sink approved, waiting for CERES verification and registration.',
    color: '#e07a2e',
    icon: ShieldCheck,
  },
  pendingSink: {
    label: 'Pending sink',
    help: 'Approved batches whose biochar has not been applied to a sink yet.',
    color: '#d9667f',
    icon: Clock3,
  },
  sinkRejected: {
    label: 'Sink rejected',
    help: 'The sink (application) was rejected.',
    color: '#c03a2b',
    icon: Ban,
  },
  compensated: {
    label: 'Compensated',
    help: 'Used to compensate methane or other losses.',
    color: '#7c5cc4',
    icon: CircleDashed,
  },
  lost: {
    label: 'Lost',
    help: 'Rejected batches — not eligible for credits.',
    color: '#8a918c',
    icon: Trash2,
  },
}

/** t CO₂e with three decimals, as on the registry. */
export const tco2 = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
