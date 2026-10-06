'use client'

/* eslint-disable @next/next/no-img-element -- images come from the authenticated /admin/files route */
import { ImagePlus, RefreshCw, X } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button, Spinner } from '../components/ui'
import { cn } from '../lib/utils'
import { unwrap } from '../lib/unwrap'
import { uploadCertificateImage } from '../server/certificates'

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif'

/** Labelled image picker that uploads straight away and reports the stored file id. */
export function ImageUpload({
  label,
  hint,
  value,
  onChange,
  error,
  compact,
}: {
  label: string
  hint?: string
  value: string | null | undefined
  onChange: (id: string | null) => void
  error?: string | null
  compact?: boolean
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const pick = async (file: File | undefined) => {
    if (!file) return
    if (!ACCEPT.split(',').includes(file.type)) {
      toast.error('Use a PNG, JPG, WebP or GIF image')
      return
    }
    setUploading(true)
    try {
      const form = new FormData()
      form.set('file', file)
      const res = unwrap(await uploadCertificateImage(form))
      onChange(res.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
      if (input.current) input.current.value = ''
    }
  }

  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-1.5" role="group" aria-labelledby={`${id}-label`} aria-describedby={describedBy}>
      <span id={`${id}-label`} className="text-xs font-bold tracking-wide text-ink-muted uppercase">
        {label}
      </span>
      <div className={cn('flex items-center gap-3 rounded-xl border border-line bg-surface p-2', error && 'border-danger')}>
        <div
          className={cn(
            'flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-muted text-ink-subtle',
            compact ? 'h-12 w-20' : 'h-16 w-24',
          )}
        >
          {uploading ? (
            <Spinner />
          ) : value ? (
            <img src={`/admin/files/${encodeURIComponent(value)}`} alt={`${label} preview`} className="size-full object-contain" />
          ) : (
            <ImagePlus className="size-5" aria-hidden />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => input.current?.click()} disabled={uploading} aria-describedby={describedBy}>
            {uploading ? <Spinner /> : value ? <RefreshCw /> : <ImagePlus />}
            {uploading ? 'Uploading…' : value ? 'Replace' : 'Upload'}
            <span className="sr-only"> {label}</span>
          </Button>
          {value && !uploading && (
            <Button size="sm" variant="ghost" onClick={() => onChange(null)} aria-label={`Remove ${label}`}>
              <X /> Remove
            </Button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => void pick(e.target.files?.[0])}
        />
      </div>
      {hint && (
        <span id={`${id}-hint`} className="text-xs text-ink-subtle">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className="text-xs text-danger">
          {error}
        </span>
      )}
    </div>
  )
}
