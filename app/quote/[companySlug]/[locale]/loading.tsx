export default function PublicQuoteLoading() {
  return (
    <main className="min-h-screen animate-pulse bg-cdl-bg">
      <div className="h-16 border-b border-cdl-border bg-cdl-surface" />
      <div className="mx-auto grid min-h-[34rem] max-w-7xl items-center gap-10 px-4 py-16 sm:px-8 lg:grid-cols-2">
        <div>
          <div className="h-3 w-40 rounded bg-cdl-inset" />
          <div className="mt-6 h-12 max-w-xl rounded-2xl bg-cdl-inset" />
          <div className="mt-3 h-12 max-w-lg rounded-2xl bg-cdl-inset" />
          <div className="mt-8 h-14 w-52 rounded-2xl bg-cdl-inset" />
        </div>
        <div className="h-64 rounded-[2rem] bg-cdl-inset" />
      </div>
    </main>
  )
}
