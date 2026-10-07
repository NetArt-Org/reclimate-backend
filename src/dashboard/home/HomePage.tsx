'use client'

import { PageHeader } from '../components/shell/PageHeader'
import { useDashboard } from '../data/store'
import { ActionCenter } from './ActionCenter'
import { ActivityMap } from './ActivityMap'
import { CaptureOverview } from './CaptureOverview'
import { FilterBar, PeriodPicker } from './FilterBar'
import { KpiCards } from './KpiCards'
import { ProductionChart } from './ProductionChart'

export function HomePage() {
  const { ready } = useDashboard()
  return (
    <>
      <PageHeader title="Overview" description="What has been captured, where, and what still needs attention." actions={ready && <PeriodPicker />} />
      {ready ? (
        <div className="flex flex-col gap-3 px-3 pb-6 sm:gap-4 sm:px-4 md:px-6">
          <FilterBar />
          {/* Numbers next to the map: clicking a place on the map focuses the numbers on it. */}
          <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-2">
            <KpiCards />
            <ActivityMap className="xl:min-h-0" />
          </div>
          {/* What has and hasn't been captured, for the same selection. */}
          <CaptureOverview />
          <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <ProductionChart />
            <ActionCenter />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 px-4 md:px-6 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-card bg-surface" />
          ))}
        </div>
      )}
    </>
  )
}
