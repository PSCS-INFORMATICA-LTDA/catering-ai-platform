export default function QuoteDetailLoading() {
  return (
    <main
      data-quote-detail-skeleton
      className="min-h-screen bg-cdl-bg px-4 py-6 sm:px-8"
    >
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-4 w-32 animate-pulse rounded bg-neutral-200" />
        <div className="h-10 w-64 animate-pulse rounded-xl bg-neutral-200" />
        <div className="h-24 animate-pulse rounded-2xl bg-neutral-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-neutral-100" />
      </div>
    </main>
  )
}
