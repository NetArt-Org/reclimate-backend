'use client'

import { Container, Flame, Pencil, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button, Card, ConfirmDialog, EmptyState, Tooltip } from '../components/ui'
import { cn, num } from '../lib/utils'
import { unwrap } from '../lib/unwrap'
import { deleteTemplate, type Template } from '../server/settings'
import { KILN_TYPE_LABEL } from './TemplateSheet'
import { formatDimensions, shapeDef, type TemplateKind } from './volume'

export const TEMPLATE_TABS: { key: TemplateKind; label: string }[] = [
  { key: 'kiln', label: 'Kilns' },
  { key: 'container', label: 'Measuring containers' },
]

/** Underlined sub-tabs: Kilns / Measuring containers. */
export function TemplateTabs({
  value,
  onChange,
  counts,
}: {
  value: TemplateKind
  onChange: (k: TemplateKind) => void
  counts: Record<TemplateKind, number>
}) {
  return (
    <div role="tablist" aria-label="Template kind" className="flex gap-1 overflow-x-auto border-b border-line px-2">
      {TEMPLATE_TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'relative flex h-12 shrink-0 cursor-pointer items-center gap-2 rounded-t-lg px-3 text-sm font-medium text-ink-muted transition-colors outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/40',
            value === t.key && 'font-semibold text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand',
          )}
        >
          {t.label}
          <span className="rounded-full bg-muted px-1.5 text-xs text-ink-muted tabular-nums">{counts[t.key]}</span>
        </button>
      ))}
    </div>
  )
}

/** Template table for one kind, with edit and delete row actions. */
export function TemplatesSection({
  kind,
  onKind,
  templates,
  onEdit,
}: {
  kind: TemplateKind
  onKind: (k: TemplateKind) => void
  templates: Template[]
  onEdit: (t: Template) => void
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState<Template | null>(null)
  const rows = templates.filter((t) => t.kind === kind)
  const counts = {
    kiln: templates.filter((t) => t.kind === 'kiln').length,
    container: templates.filter((t) => t.kind === 'container').length,
  }
  const isKiln = kind === 'kiln'

  const remove = async (t: Template) => {
    try {
      unwrap(await deleteTemplate(t.id))
      toast.success(`Deleted ${t.name}`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  const cols = isKiln
    ? 'grid-cols-[40px_minmax(160px,1.5fr)_100px_minmax(150px,1fr)_minmax(170px,1.2fr)_110px_84px]'
    : 'grid-cols-[40px_minmax(160px,1.5fr)_minmax(150px,1fr)_minmax(170px,1.2fr)_110px_84px]'

  return (
    <Card className="overflow-hidden">
      <TemplateTabs value={kind} onChange={onKind} counts={counts} />

      {rows.length === 0 ? (
        <EmptyState
          icon={isKiln ? <Flame /> : <Container />}
          title={isKiln ? 'No kiln templates yet' : 'No container templates yet'}
          sub={
            isKiln
              ? 'Add a kiln template so field teams can pick a standard kiln shape and volume.'
              : 'Add a measuring container so field teams can record biochar by volume.'
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <div className={isKiln ? 'min-w-[820px]' : 'min-w-[720px]'} role="table" aria-label={isKiln ? 'Kiln templates' : 'Container templates'}>
            <div role="row" className={cn('grid items-center gap-4 border-b border-line bg-muted px-4 py-2.5 text-xs font-semibold text-ink-muted', cols)}>
              <span role="columnheader" className="text-right">
                #
              </span>
              <span role="columnheader">Name</span>
              {isKiln && <span role="columnheader">Type</span>}
              <span role="columnheader">Shape</span>
              <span role="columnheader">Dimensions</span>
              <span role="columnheader" className="text-right">
                Volume
              </span>
              <span role="columnheader" className="sr-only">
                Actions
              </span>
            </div>
            {rows.map((t, i) => (
              <div
                key={t.id}
                role="row"
                className={cn('grid items-center gap-4 border-b border-line px-4 py-2.5 text-[13px] transition-colors last:border-0 hover:bg-muted/70', cols)}
              >
                <span role="cell" className="text-right text-ink-muted tabular-nums">
                  {i + 1}
                </span>
                <span role="cell" className="truncate font-semibold" title={t.name}>
                  {t.name}
                </span>
                {isKiln && (
                  <span role="cell" className="text-ink-2">
                    {t.kilnType ? KILN_TYPE_LABEL[t.kilnType] : '—'}
                  </span>
                )}
                <span role="cell" className="truncate text-ink-2">
                  {shapeDef(kind, t.shape)?.label ?? t.shape}
                </span>
                <span role="cell" className="truncate text-ink-2 tabular-nums">
                  {formatDimensions(t.shape, t.dimensions, t.unit)}
                </span>
                <span role="cell" className="text-right font-semibold tabular-nums">
                  {num(t.volumeL, 1)} L
                </span>
                <span role="cell" className="flex justify-end gap-1">
                  <Tooltip content="Edit">
                    <Button variant="ghost" size="icon-sm" onClick={() => onEdit(t)} aria-label={`Edit ${t.name}`}>
                      <Pencil />
                    </Button>
                  </Tooltip>
                  <Tooltip content="Delete">
                    <Button variant="ghost" size="icon-sm" className="hover:bg-danger-soft hover:text-danger" onClick={() => setDeleting(t)} aria-label={`Delete ${t.name}`}>
                      <Trash2 />
                    </Button>
                  </Tooltip>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="border-t border-line px-4 py-2.5 text-xs text-ink-muted">
          {rows.length} {isKiln ? (rows.length === 1 ? 'kiln template' : 'kiln templates') : rows.length === 1 ? 'container template' : 'container templates'}
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete template?"
        message={deleting ? `"${deleting.name}" will no longer be available in the field app. This cannot be undone.` : ''}
        onConfirm={() => {
          if (deleting) void remove(deleting)
        }}
      />
    </Card>
  )
}
