/**
 * Shown instantly while a page's data loads (the sidebar and top bar stay in place), so moving
 * between sections never feels frozen.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-3 px-3 pt-4 pb-6 sm:gap-4 sm:px-4 md:px-6 md:pt-5" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <div className="h-6 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-9 w-28 animate-pulse rounded-lg bg-surface" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-card border border-line bg-surface" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-card border border-line bg-surface" />
    </div>
  )
}
