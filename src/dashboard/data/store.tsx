'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { uid } from '../lib/utils'
import { ROLE_ORDER } from './catalog'
import { createMockData } from './mock'
import type { Company, DashboardData, DocFile, Filters, Kiln, Network, NetworkConfig, PartnerOrg, Site, User } from './types'

/**
 * Dashboard state for the prototype: mock data kept in this browser, so every
 * add / edit / delete can be tried before the backend is wired up. Each action
 * below becomes one API call (or Payload local-API call) later.
 */
const STORAGE_KEY = 'reclimate-dashboard-v3'

export const DEFAULT_FILTERS: Filters = {
  orgId: null,
  networkType: null,
  networkIds: [],
  siteIds: [],
  cutoff: false,
  vintages: [],
  period: { kind: 'all' },
}

interface Saved {
  data: DashboardData
  filters: Filters
}

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Saved) : null
  } catch {
    return null
  }
}

function useDashboardState() {
  const [data, setData] = useState<DashboardData>(createMockData)
  const [filters, setFiltersRaw] = useState<Filters>(DEFAULT_FILTERS)
  const [ready, setReady] = useState(false)

  // Restore after mount (the page is server-rendered; localStorage only exists in the browser).
  useEffect(() => {
    const saved = load()
    /* eslint-disable react-hooks/set-state-in-effect -- one-time restore from browser storage */
    if (saved) {
      setData(saved.data)
      setFiltersRaw({ ...DEFAULT_FILTERS, ...saved.filters })
    }
    setReady(true)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  useEffect(() => {
    if (!ready) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ data, filters } satisfies Saved))
    } catch {
      /* storage full (large uploads) or unavailable — keep working in memory */
    }
  }, [data, filters, ready])

  /** Apply a change to a copy of the data. */
  const mutate = useCallback((recipe: (d: DashboardData) => void) => {
    setData((cur) => {
      const next = structuredClone(cur)
      recipe(next)
      return next
    })
  }, [])

  const setFilters = useCallback((patch: Partial<Filters> | ((f: Filters) => Partial<Filters>)) => {
    setFiltersRaw((cur) => ({ ...cur, ...(typeof patch === 'function' ? patch(cur) : patch) }))
  }, [])

  const actions = useMemo(
    () => ({
      /* ---------- company (C-sink manager) ---------- */
      /** Change the company profile; `log` adds a line to its audit trail. */
      updateCompany: (recipe: (c: Company) => void, log?: { by: string; change: string }) =>
        mutate((d) => {
          recipe(d.company)
          if (log) d.company.audit.unshift({ id: uid('au-'), at: new Date().toISOString(), ...log })
        }),
      updateOrg: (id: string, recipe: (o: PartnerOrg) => void) =>
        mutate((d) => {
          const o = d.orgs.find((x) => x.id === id)
          if (o) recipe(o)
        }),

      /* ---------- partner organisations & networks ---------- */
      addOrg: (o: Omit<PartnerOrg, 'id'>) => mutate((d) => void d.orgs.push({ ...o, id: uid('org-') })),

      addNetwork: (n: Omit<Network, 'id' | 'config'> & { config?: Partial<NetworkConfig> }) => {
        const id = uid('net-')
        mutate((d) =>
          void d.networks.push({
            ...n,
            id,
            config: { feedstocks: [], mixingTypes: [], applicationTypes: [], references: [], ...n.config },
          }),
        )
        return id
      },
      updateNetwork: (id: string, patch: Partial<Network>) =>
        mutate((d) => {
          const n = d.networks.find((x) => x.id === id)
          if (n) Object.assign(n, patch)
        }),
      updateConfig: (id: string, config: NetworkConfig) =>
        mutate((d) => {
          const n = d.networks.find((x) => x.id === id)
          if (n) n.config = config
        }),

      updateSite: (id: string, patch: Partial<Site>) =>
        mutate((d) => {
          const site = d.sites.find((x) => x.id === id)
          if (site) Object.assign(site, patch)
        }),
      updateKiln: (id: string, patch: Partial<Kiln>) =>
        mutate((d) => {
          const k = d.kilns.find((x) => x.id === id)
          if (k) Object.assign(k, patch)
        }),

      /* ---------- people ---------- */
      addUser: (u: Omit<User, 'id' | 'trainingDocs' | 'otpBypass'>) => {
        const id = uid('u-')
        mutate((d) => void d.users.push({ ...u, id, otpBypass: false, trainingDocs: [] }))
        return id
      },
      updateUser: (id: string, patch: Partial<User>) =>
        mutate((d) => {
          const u = d.users.find((x) => x.id === id)
          if (u) Object.assign(u, patch)
        }),
      deleteUser: (id: string) => mutate((d) => void (d.users = d.users.filter((u) => u.id !== id))),
      promoteUser: (id: string) =>
        mutate((d) => {
          const u = d.users.find((x) => x.id === id)
          if (!u) return
          const i = ROLE_ORDER.indexOf(u.role)
          if (i < ROLE_ORDER.length - 1) u.role = ROLE_ORDER[i + 1]
        }),
      addTrainingDoc: (id: string, doc: DocFile) =>
        mutate((d) => void d.users.find((x) => x.id === id)?.trainingDocs.push(doc)),
      removeTrainingDoc: (id: string, docId: string) =>
        mutate((d) => {
          const u = d.users.find((x) => x.id === id)
          if (u) u.trainingDocs = u.trainingDocs.filter((x) => x.id !== docId)
        }),

      /* ---------- action center ---------- */
      resolveAlert: (id: string, status: 'approved' | 'rejected' | 'dismissed') =>
        mutate((d) => {
          const a = d.alerts.find((x) => x.id === id)
          if (!a) return
          a.status = status
          // Approving a bulk-density request updates that network's reference value.
          if (status === 'approved' && a.request && a.networkId) {
            const n = d.networks.find((x) => x.id === a.networkId)
            const ref = n?.config.references.find((x) => x.feedstock === a.request!.feedstock)
            if (ref) ref.bulkDensity = a.request.bulkDensity
          }
          d.logs.unshift({ id: uid('log-'), date: new Date().toISOString(), message: `Alert ${status}: ${a.message}`, networkId: a.networkId })
        }),

      resetDemo: () => {
        setData(createMockData())
        setFiltersRaw(DEFAULT_FILTERS)
      },
    }),
    [mutate],
  )

  return { data, filters, setFilters, ready, ...actions }
}

export type DashboardStore = ReturnType<typeof useDashboardState>

const Ctx = createContext<DashboardStore | null>(null)

export function DashboardProvider({ children }: { children: ReactNode }) {
  const store = useDashboardState()
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useDashboard() {
  const store = useContext(Ctx)
  if (!store) throw new Error('useDashboard must be used inside <DashboardProvider>')
  return store
}
