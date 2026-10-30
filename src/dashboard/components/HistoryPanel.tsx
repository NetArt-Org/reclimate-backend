'use client'

import { History } from 'lucide-react'
import { useEffect, useState } from 'react'

import { unwrap } from '../lib/unwrap'
import { day } from '../lib/utils'
import { getHistory, type HistoryEntry } from '../server/history'
import { Button, Sheet, Spinner } from './ui'

const label = (field: string) => {
  const t = field.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}
const value = (v: unknown) => (v == null || v === '' ? '—' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v))
const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

/** "History" button + panel: every change made to one record from the admin panel — who, when, old → new. */
export function HistoryButton({ entity, entityId, title, size = 'sm' }: { entity: string; entityId: string; title: string; size?: 'sm' | 'icon-sm' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size={size} variant="ghost" className="rounded-lg" onClick={() => setOpen(true)} aria-label={`History of ${title}`}>
        <History /> {size === 'sm' && 'History'}
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title={`History · ${title}`}>
        {open && <HistoryList entity={entity} entityId={entityId} />}
      </Sheet>
    </>
  )
}

export function HistoryList({ entity, entityId }: { entity: string; entityId: string }) {
  const [rows, setRows] = useState<HistoryEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    getHistory(entity, entityId)
      .then(unwrap)
      .then((r) => live && setRows(r))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : 'Could not load the history'))
    return () => {
      live = false
    }
  }, [entity, entityId])

  if (error) return <p className="text-sm text-danger">{error}</p>
  if (!rows) return <Spinner />
  if (!rows.length) return <p className="text-sm text-ink-muted">No changes recorded yet. Changes made from now on are listed here with who made them.</p>

  return (
    <ol className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.id} className="rounded-xl border border-line px-4 py-3">
          <div className="text-sm font-semibold">{r.message}</div>
          <div className="mt-0.5 text-xs text-ink-muted">
            {r.by || 'Unknown'}
            {r.byEmail && r.byEmail !== r.by ? ` (${r.byEmail})` : ''} · {day(r.at)} {time(r.at)}
          </div>
          {r.changes.length > 0 && (
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              {r.changes.map((c) => (
                <div key={c.field} className="contents">
                  <dt className="font-semibold text-ink-2">{label(c.field)}</dt>
                  <dd className="min-w-0 break-words text-ink-muted">
                    <span className="line-through decoration-ink-subtle">{value(c.from)}</span> → <span className="text-ink">{value(c.to)}</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </li>
      ))}
    </ol>
  )
}
