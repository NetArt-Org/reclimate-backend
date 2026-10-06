'use client'

import { useMemo } from 'react'

import { useDashboard } from '../data/store'
import type { Kiln } from '../data/types'

/** Resolve network / site / kiln / person ids to display names. */
export function useNames() {
  const { data } = useDashboard()
  return useMemo(() => {
    const networks = new Map(data.networks.map((n) => [n.id, n.name]))
    const orgs = new Map(data.orgs.map((o) => [o.id, o.name]))
    const orgOf = new Map(data.networks.map((n) => [n.id, n.orgId]))
    const sites = new Map(data.sites.map((s) => [s.id, s.name]))
    const kilns = new Map<string, Kiln>(data.kilns.map((k) => [k.id, k]))
    const people = new Map(data.users.map((u) => [u.id, u.name]))
    return {
      /** Partner organisation that owns a network. */
      org: (networkId: string | null | undefined) => (networkId && orgs.get(orgOf.get(networkId) ?? '')) || '—',
      network: (id: string | null | undefined) => (id && networks.get(id)) || '—',
      site: (id: string | null | undefined) => (id && sites.get(id)) || '—',
      kiln: (id: string | null | undefined) => (id ? kilns.get(id) : undefined),
      person: (id: string | null | undefined) => (id && people.get(id)) || '—',
    }
  }, [data.networks, data.orgs, data.sites, data.kilns, data.users])
}

export type Names = ReturnType<typeof useNames>
