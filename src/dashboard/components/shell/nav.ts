import { Building2, Factory, LayoutDashboard, Network, Settings, Trees } from 'lucide-react'

/** Sidebar, in groups. `soon` sections are placeholders until their screens are designed. */
export const SECTIONS = [
  {
    label: 'Overview',
    items: [{ href: '/admin', label: 'Overview', icon: LayoutDashboard, soon: false }],
  },
  {
    label: 'Operations',
    items: [
      { href: '/admin/networks', label: 'Networks & people', icon: Network, soon: false },
      { href: '/admin/production', label: 'Production', icon: Factory, soon: true },
      { href: '/admin/credits', label: 'Carbon credits', icon: Trees, soon: true },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin/account', label: 'Account & company', icon: Building2, soon: false },
      { href: '/admin/settings', label: 'Settings', icon: Settings, soon: true },
    ],
  },
]
