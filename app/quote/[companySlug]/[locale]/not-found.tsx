import Link from 'next/link'

export default function PublicQuoteNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cdl-bg px-4 py-12 text-cdl-fg">
      <section className="max-w-xl rounded-[2rem] border border-cdl-border bg-cdl-surface p-8 text-center shadow-xl sm:p-10">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-cdl-muted">
          Quote unavailable
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-cdl-title">
          This quote link is not available
        </h1>
        <p className="mt-4 text-sm leading-6 text-cdl-muted">
          Check the company and language in the link or contact the catering
          team that shared it with you.
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl border border-cdl-border px-6 text-sm font-bold"
        >
          Back to home
        </Link>
      </section>
    </main>
  )
}
