'use client'

/* eslint-disable @next/next/no-img-element -- files are streamed by our own authenticated route, not next/image */

import { ChevronLeft, ChevronRight, CloudOff, ExternalLink, FileText, ImageOff, Images, Play } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button, Modal } from '../components/ui'
import { cn } from '../lib/utils'
import type { FileRef } from '../server/production-extra'

export const fileUrl = (id: string) => `/admin/files/${id}`
export const isImage = (f: FileRef) => /^image\/(png|jpe?g|gif|webp)$/.test(f.mimeType)
export const isVideo = (f: FileRef) => f.mimeType.startsWith('video/')
const viewable = (f: FileRef) => f.status === 'stored'

/** "kiln_process_biomass_moisture" → "Kiln process biomass moisture" */
export const categoryLabel = (c: string) => {
  const t = c
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
  return t ? t[0].toUpperCase() + t.slice(1) : 'Other'
}

/* ------------------------------------------------------------------ */
/* Lightbox                                                            */
/* ------------------------------------------------------------------ */

export function Lightbox({ images, index, onIndex }: { images: FileRef[]; index: number | null; onIndex: (i: number | null) => void }) {
  const open = index != null && !!images[index]
  const f = open ? images[index] : null
  const step = useCallback(
    (d: number) => {
      if (index == null || images.length < 2) return
      onIndex((index + d + images.length) % images.length)
    },
    [index, images.length, onIndex],
  )
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') step(-1)
      if (e.key === 'ArrowRight') step(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, step])

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onIndex(null)}
      title={f ? categoryLabel(f.category) : 'Photo'}
      description={f ? `${f.name} · ${(index ?? 0) + 1} of ${images.length}` : undefined}
      className="max-w-5xl"
    >
      {f && (
        <div className="flex flex-col gap-3">
          <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-muted">
            <img key={f.id} src={fileUrl(f.id)} alt={`${categoryLabel(f.category)} photo ${f.name}`} className="size-full object-contain" />
            {images.length > 1 && (
              <>
                <Button size="icon" aria-label="Previous photo" onClick={() => step(-1)} className="absolute top-1/2 left-2 -translate-y-1/2 shadow-md">
                  <ChevronLeft />
                </Button>
                <Button size="icon" aria-label="Next photo" onClick={() => step(1)} className="absolute top-1/2 right-2 -translate-y-1/2 shadow-md">
                  <ChevronRight />
                </Button>
              </>
            )}
          </div>
          <div className="flex justify-end">
            <a
              href={fileUrl(f.id)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md text-xs font-semibold text-brand outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              <ExternalLink className="size-3.5" aria-hidden /> Open original
            </a>
          </div>
        </div>
      )}
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Tiles                                                               */
/* ------------------------------------------------------------------ */

function Placeholder({ f, compact }: { f: FileRef; compact?: boolean }) {
  const failed = f.status === 'failed'
  const Icon = failed ? ImageOff : CloudOff
  return (
    <div
      className="flex size-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line-strong bg-muted text-center text-ink-subtle"
      title={`${f.name}: ${failed ? 'copy failed' : 'not copied yet'}`}
    >
      <Icon className={compact ? 'size-3.5' : 'size-5'} aria-hidden />
      {!compact && <span className="px-2 text-[11px] font-semibold">{failed ? 'Copy failed' : 'Not copied yet'}</span>}
      <span className="sr-only">{`${f.name}, ${failed ? 'copy failed' : 'not copied yet'}`}</span>
    </div>
  )
}

/** One fixed-aspect media tile: image (opens lightbox), video, PDF/file chip, or a placeholder when not copied yet. */
export function MediaTile({ f, onOpen }: { f: FileRef; onOpen?: () => void }) {
  if (!viewable(f)) {
    return (
      <div className="aspect-[4/3]">
        <Placeholder f={f} />
      </div>
    )
  }
  if (isImage(f)) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label={`View photo ${f.name}`}
        className="group/tile block aspect-[4/3] w-full cursor-zoom-in overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <img src={fileUrl(f.id)} alt="" loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-200 group-hover/tile:scale-[1.03]" />
      </button>
    )
  }
  if (isVideo(f)) {
    return (
      <div className="aspect-[4/3] overflow-hidden rounded-xl bg-ink">
        <video controls preload="none" src={fileUrl(f.id)} className="size-full object-contain" aria-label={`Video ${f.name}`} />
      </div>
    )
  }
  return (
    <a
      href={fileUrl(f.id)}
      target="_blank"
      rel="noreferrer"
      className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-xl border border-line bg-muted px-2 text-center text-ink-2 outline-none hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand/40"
    >
      <FileText className="size-5 text-brand" aria-hidden />
      <span className="line-clamp-2 text-[11px] font-semibold break-all">{f.name}</span>
    </a>
  )
}

/** Media grouped by category, with a lightbox across all viewable images. */
export function MediaGallery({ files, className }: { files: FileRef[]; className?: string }) {
  const images = useMemo(() => files.filter((f) => viewable(f) && isImage(f)), [files])
  const groups = useMemo(() => {
    const m = new Map<string, FileRef[]>()
    for (const f of files) m.set(f.category, [...(m.get(f.category) ?? []), f])
    return [...m.entries()]
  }, [files])
  const [index, setIndex] = useState<number | null>(null)
  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {groups.map(([cat, list]) => (
        <section key={cat} aria-label={categoryLabel(cat)}>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wide text-ink-muted uppercase">
            {categoryLabel(cat)}
            <span className="rounded-md bg-muted px-1.5 font-semibold text-ink-subtle tabular-nums">{list.length}</span>
          </h3>
          <MediaGrid files={list} onOpen={(f) => setIndex(images.indexOf(f))} />
        </section>
      ))}
      <Lightbox images={images} index={index} onIndex={setIndex} />
    </div>
  )
}

export function MediaGrid({ files, onOpen }: { files: FileRef[]; onOpen: (f: FileRef) => void }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {files.map((f) => (
        <li key={f.id}>
          <MediaTile f={f} onOpen={() => onOpen(f)} />
        </li>
      ))}
    </ul>
  )
}

/** Compact thumbnails for a table row: first few files plus a "+N" count. Images open a lightbox. */
export function MediaStrip({ files, max = 3 }: { files: FileRef[]; max?: number }) {
  const images = useMemo(() => files.filter((f) => viewable(f) && isImage(f)), [files])
  const [index, setIndex] = useState<number | null>(null)
  if (!files.length) return <span className="text-ink-subtle">—</span>
  const shown = files.slice(0, max)
  const rest = files.length - shown.length
  return (
    <div className="flex items-center gap-1">
      {shown.map((f) => {
        const box = 'size-8 shrink-0 overflow-hidden rounded-md'
        if (!viewable(f))
          return (
            <span key={f.id} className={box}>
              <Placeholder f={f} compact />
            </span>
          )
        if (isImage(f))
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setIndex(images.indexOf(f))}
              aria-label={`View photo ${f.name}`}
              className={cn(box, 'cursor-zoom-in bg-muted outline-none focus-visible:ring-2 focus-visible:ring-brand/40')}
            >
              <img src={fileUrl(f.id)} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
            </button>
          )
        const Icon = isVideo(f) ? Play : FileText
        return (
          <a
            key={f.id}
            href={fileUrl(f.id)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${f.name}`}
            className={cn(box, 'flex items-center justify-center bg-muted text-brand outline-none hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand/40')}
          >
            <Icon className="size-3.5" aria-hidden />
          </a>
        )
      })}
      {rest > 0 && (
        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold text-ink-muted tabular-nums" title={`${files.length} files`}>
          <Images className="size-3" aria-hidden />+{rest}
        </span>
      )}
      <Lightbox images={images} index={index} onIndex={setIndex} />
    </div>
  )
}
