import { Building2, Factory, LayoutDashboard, Network, Settings, Trees } from 'lucide-react'

/** Sidebar, in groups. */
export const SECTIONS = [
  {
    label: 'Overview',
    items: [{ href: '/admin', label: 'Overview', icon: LayoutDashboard }],
  },
  {
    label: 'Operations',
    items: [
      { href: '/admin/production', label: 'Production', icon: Factory },
      { href: '/admin/portfolio', label: 'Projects portfolio', icon: Trees },
      { href: '/admin/networks', label: 'Networks & people', icon: Network },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin/account', label: 'Account & company', icon: Building2 },
      { href: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
]
