export default function QuotesListLoading() {
  return (
    <main data-quotes-list-skeleton className="min-h-screen bg-cdl-bg p-4 sm:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-neutral-200" />
        <div className="h-28 animate-pulse rounded-2xl bg-neutral-100" />
        <div className="space-y-3">
          <div className="h-28 animate-pulse rounded-2xl bg-neutral-100" />
          <div className="h-28 animate-pulse rounded-2xl bg-neutral-100" />
          <div className="h-28 animate-pulse rounded-2xl bg-neutral-100" />
        </div>
      </div>
    </main>
  )
}
