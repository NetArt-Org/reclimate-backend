'use client'

import { PageHeader } from '../components/shell/PageHeader'
import { useDashboard } from '../data/store'
import { ActionCenter } from './ActionCenter'
import { ActivityMap } from './ActivityMap'
import { FilterBar, PeriodPicker } from './FilterBar'
import { KpiCards } from './KpiCards'
import { ProductionChart } from './ProductionChart'

export function HomePage() {
  const { ready } = useDashboard()
  return (
    <>
      <PageHeader title="Overview" description="Production, carbon removal and credits across your networks." actions={ready && <PeriodPicker />} />
      {ready ? (
        <div className="flex flex-col gap-4 px-4 pb-8 md:px-6">
          <FilterBar />
          <KpiCards />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <ProductionChart />
            <ActionCenter />
          </div>
          <ActivityMap />
        </div>
      ) : (
        <div className="grid gap-4 px-4 md:px-6 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-card bg-surface" />
          ))}
        </div>
      )}
    </>
  )
}
