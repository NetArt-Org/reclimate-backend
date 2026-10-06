'use client'

import { Check, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button, Spinner, Textarea } from '../components/ui'
import { unwrap } from '../lib/unwrap'
import { assessBatch } from '../server/production'

/** A batch can be assessed while it waits for us, or after the network approved it. */
export const canAssess = (status: string) => status === 'not_assessed' || status === 'approved'

/** Approve / reject buttons; rejecting asks for a reason first. Render with `key={id}` to reset per batch. */
export function AssessActions({ id, code }: { id: string; code: string }) {
  const router = useRouter()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, start] = useTransition()

  const decide = (decision: 'approve' | 'reject') =>
    start(async () => {
      try {
        unwrap(await assessBatch(id, decision, decision === 'reject' ? reason.trim() : undefined))
        toast.success(decision === 'approve' ? `Batch ${code} approved` : `Batch ${code} rejected`)
        setRejecting(false)
        setReason('')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not save the assessment')
      }
    })

  if (rejecting)
    return (
      <div className="flex w-full flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold tracking-wide text-ink-muted uppercase">Reason for rejection (required)</span>
          <Textarea
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What is wrong with this batch?"
            className="min-h-20"
          />
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={() => setRejecting(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => decide('reject')} disabled={pending || !reason.trim()}>
            {pending ? <Spinner className="text-white" /> : <X />} Reject batch
          </Button>
        </div>
      </div>
    )

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="danger-soft" onClick={() => setRejecting(true)} disabled={pending}>
        <X /> Reject
      </Button>
      <Button variant="primary" onClick={() => decide('approve')} disabled={pending}>
        {pending ? <Spinner className="text-white" /> : <Check />} Approve
      </Button>
    </div>
  )
}
