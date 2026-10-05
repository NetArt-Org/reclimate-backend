import { Hammer } from 'lucide-react'

export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-1 flex-col">
      <h1 className="px-5 pt-6 text-2xl font-bold tracking-tight md:px-8">{title}</h1>
      <div className="m-8 flex flex-1 flex-col items-center justify-center gap-3 rounded-card border border-dashed border-line-strong bg-surface/60 p-10 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted text-ink-muted">
          <Hammer className="size-6" />
        </div>
        <div className="text-lg font-bold">This section is next</div>
        <p className="max-w-sm text-sm text-ink-muted">
          It will be built from the screenshots of this tab, the same way as Home and My Networks.
        </p>
      </div>
    </div>
  )
}
