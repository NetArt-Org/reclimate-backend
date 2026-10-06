'use client'

import { useRouter } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { unwrap } from '../lib/unwrap'
import * as server from '../server/actions'
import type { ActionResult } from '../server/result'
import { ROLE_ORDER } from './catalog'
import type { Company, DashboardData, DocFile, Filters, Kiln, Network, NetworkConfig, PartnerOrg, Site, User } from './types'

/**
 * Dashboard state. The data comes from Neon (loaded on the server by the admin layout);
 * every action updates the screen at once, then saves through a server action.
 * If a save fails, the error is shown and the data is reloaded from the database.
 * Only the filters are kept in this browser.
 */
const FILTERS_KEY = 'reclimate-dashboard-filters'

export const DEFAULT_FILTERS: Filters = {
  orgId: null,
  networkType: null,
  networkIds: [],
  siteIds: [],
  cutoff: false,
  vintages: [],
  period: { kind: 'all' },
}

const newId = () => crypto.randomUUID()

function useDashboardState(initial: DashboardData) {
  const router = useRouter()
  const [data, setData] = useState<DashboardData>(initial)
  const dataRef = useRef(initial)
  const [filters, setFiltersRaw] = useState<Filters>(DEFAULT_FILTERS)
  const [ready, setReady] = useState(false)

  // Fresh data from the server (after router.refresh() or a revalidation) replaces the local copy.
  useEffect(() => {
    dataRef.current = initial
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing to new server data
    setData(initial)
  }, [initial])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(FILTERS_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore of a per-browser preference
      if (saved) setFiltersRaw({ ...DEFAULT_FILTERS, ...(JSON.parse(saved) as Filters) })
    } catch {
      /* storage unavailable */
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(filters))
    } catch {
      /* ignore */
    }
  }, [filters, ready])

  /** Apply a change on screen, then save it. `save` receives the updated data and returns the server action's result. */
  const mutate = useCallback(
    (recipe: (d: DashboardData) => void, save?: (next: DashboardData) => Promise<ActionResult<unknown>>) => {
      const next = structuredClone(dataRef.current)
      recipe(next)
      dataRef.current = next
      setData(next)
      // A failed result rejects too, so its message reaches the toast.
      save?.(next).then(unwrap).catch((err: unknown) => {
        toast.error('Could not save the change', { description: err instanceof Error ? err.message : String(err) })
        router.refresh()
      })
    },
    [router],
  )

  const setFilters = useCallback((patch: Partial<Filters> | ((f: Filters) => Partial<Filters>)) => {
    setFiltersRaw((cur) => ({ ...cur, ...(typeof patch === 'function' ? patch(cur) : patch) }))
  }, [])

  const actions = useMemo(() => {
    const byId = <T extends { id: string }>(list: T[], id: string) => list.find((x) => x.id === id)
    const saveNetwork = (id: string) => (d: DashboardData) => server.saveNetwork(byId(d.networks, id)!)
    const savePerson = (id: string) => (d: DashboardData) => server.savePerson(byId(d.users, id)!)

    return {
      /* ---------- company (C-sink manager) ---------- */
      /** Change the company profile; `log` adds a line to its audit trail. */
      updateCompany: (recipe: (c: Company) => void, log?: { by: string; change: string }) =>
        mutate(
          (d) => {
            recipe(d.company)
            if (log) d.company.audit.unshift({ id: newId(), at: new Date().toISOString(), ...log })
          },
          (d) => server.saveCompany(d.company),
        ),
      updateOrg: (id: string, recipe: (o: PartnerOrg) => void) =>
        mutate(
          (d) => {
            const o = byId(d.orgs, id)
            if (o) recipe(o)
          },
          (d) => server.saveOrg(byId(d.orgs, id)!),
        ),

      /* ---------- partner organisations & networks ---------- */
      addOrg: (o: Omit<PartnerOrg, 'id'>) => {
        const id = newId()
        mutate(
          (d) => void d.orgs.push({ ...o, id }),
          (d) => server.saveOrg(byId(d.orgs, id)!),
        )
        return id
      },

      addNetwork: (x: Omit<Network, 'id' | 'config'> & { config?: Partial<NetworkConfig> }) => {
        const id = newId()
        mutate(
          (d) =>
            void d.networks.push({
              ...x,
              id,
              config: { feedstocks: [], mixingTypes: [], applicationTypes: [], references: [], ...x.config },
            }),
          saveNetwork(id),
        )
        return id
      },
      updateNetwork: (id: string, patch: Partial<Network>) =>
        mutate((d) => {
          const x = byId(d.networks, id)
          if (x) Object.assign(x, patch)
        }, saveNetwork(id)),
      updateConfig: (id: string, config: NetworkConfig) =>
        mutate((d) => {
          const x = byId(d.networks, id)
          if (x) x.config = config
        }, saveNetwork(id)),

      updateSite: (id: string, patch: Partial<Site>) =>
        mutate(
          (d) => {
            const s = byId(d.sites, id)
            if (s) Object.assign(s, patch)
          },
          (d) => server.saveSite(byId(d.sites, id)!),
        ),
      updateKiln: (id: string, patch: Partial<Kiln>) =>
        mutate(
          (d) => {
            const k = byId(d.kilns, id)
            if (k) Object.assign(k, patch)
          },
          (d) => server.saveKiln(byId(d.kilns, id)!),
        ),

      /* ---------- people ---------- */
      addUser: (u: Omit<User, 'id' | 'trainingDocs' | 'otpBypass'>) => {
        const id = newId()
        mutate((d) => void d.users.push({ ...u, id, otpBypass: false, trainingDocs: [] }), savePerson(id))
        return id
      },
      updateUser: (id: string, patch: Partial<User>) =>
        mutate((d) => {
          const u = byId(d.users, id)
          if (u) Object.assign(u, patch)
        }, savePerson(id)),
      deleteUser: (id: string) =>
        mutate(
          (d) => void (d.users = d.users.filter((u) => u.id !== id)),
          () => server.deletePerson(id),
        ),
      promoteUser: (id: string) =>
        mutate((d) => {
          const u = byId(d.users, id)
          if (!u) return
          const i = ROLE_ORDER.indexOf(u.role)
          if (i < ROLE_ORDER.length - 1) u.role = ROLE_ORDER[i + 1]
        }, savePerson(id)),
      addTrainingDoc: (id: string, doc: DocFile) =>
        mutate((d) => void byId(d.users, id)?.trainingDocs.push(doc), savePerson(id)),
      removeTrainingDoc: (id: string, docId: string) =>
        mutate((d) => {
          const u = byId(d.users, id)
          if (u) u.trainingDocs = u.trainingDocs.filter((x) => x.id !== docId)
        }, savePerson(id)),

      /* ---------- action center ---------- */
      resolveAlert: (id: string, status: 'approved' | 'rejected' | 'dismissed') =>
        mutate(
          (d) => {
            const a = byId(d.alerts, id)
            if (!a) return
            a.status = status
            // Approving a bulk-density request updates that network's reference value.
            if (status === 'approved' && a.request && a.networkId) {
              const ref = byId(d.networks, a.networkId)?.config.references.find((x) => x.feedstock === a.request!.feedstock)
              if (ref) ref.bulkDensity = a.request.bulkDensity
            }
            d.logs.unshift({ id: newId(), date: new Date().toISOString(), message: `Alert ${status}: ${a.message}`, networkId: a.networkId })
          },
          () => server.resolveAlert(id, status),
        ),

      /** Reload everything from Neon. */
      reload: () => router.refresh(),
    }
  }, [mutate, router])

  return { data, filters, setFilters, ready, ...actions }
}

export type DashboardStore = ReturnType<typeof useDashboardState>

const Ctx = createContext<DashboardStore | null>(null)

export function DashboardProvider({ initial, children }: { initial: DashboardData; children: ReactNode }) {
  const store = useDashboardState(initial)
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useDashboard() {
  const store = useContext(Ctx)
  if (!store) throw new Error('useDashboard must be used inside <DashboardProvider>')
  return store
}
