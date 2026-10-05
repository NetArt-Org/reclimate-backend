'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

/** The signed-in admin (from the backend session). */
export interface SessionUser {
  id: number
  name: string
  username?: string
  email?: string
  phone?: string
}

const Ctx = createContext<{ user: SessionUser; setUser: (u: SessionUser) => void } | null>(null)

export function SessionProvider({ user: initial, children }: { user: SessionUser; children: ReactNode }) {
  const [user, setUser] = useState(initial)
  return <Ctx.Provider value={{ user, setUser }}>{children}</Ctx.Provider>
}

export function useSession() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useSession must be used inside <SessionProvider>')
  return s
}
