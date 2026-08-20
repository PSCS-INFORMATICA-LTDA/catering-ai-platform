'use client'

import Link from 'next/link'
import AdditionalItemImageUploadPanel from '@/components/AdditionalItemImageUploadPanel'
import PackageImageUploadPanel from '@/components/PackageImageUploadPanel'
import type { CatalogItemListItem } from '@/Lib/fetchCatalogItems'
import { tPackages } from '@/Lib/i18n/packages'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'

type PackageImageRow = {
  id: string
  package_key?: string | null
  package_name?: string | null
  label_pt?: string | null
  image_url?: string | null
}

export default function CatalogImagesDashboard({
  packages,
  items,
  packagesError,
  catalogError,
}: {
  packages: PackageImageRow[]
  items: CatalogItemListItem[]
  packagesError: string | null
  catalogError: string | null
}) {
  const locale = useAuthLocaleFromMe()

  return (
    <main className="text-cdl-fg">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <h1 className="text-2xl font-black text-cdl-title">
            {tPackages(locale, 'imagesTitle')}
          </h1>
          <p className="mt-1 text-sm text-cdl-muted">
            {tPackages(locale, 'imagesSubtitle')}
          </p>
        </div>

        <nav className="flex flex-wrap gap-2">
          <a
            href="#pacotes"
            className="inline-flex min-h-[40px] items-center rounded-xl border border-cdl-border bg-cdl-surface px-4 py-2 text-xs font-bold uppercase tracking-wider text-cdl-fg hover:border-cdl-accent-border"
          >
            {tPackages(locale, 'title')}
          </a>
          <a
            href="#catalogo-itens"
            className="inline-flex min-h-[40px] items-center rounded-xl border border-cdl-border bg-cdl-surface px-4 py-2 text-xs font-bold uppercase tracking-wider text-cdl-fg hover:border-cdl-accent-border"
          >
            {tPackages(locale, 'itemsTitle')}
          </a>
        </nav>

        <section id="pacotes" className="scroll-mt-24 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-cdl-title">
                {tPackages(locale, 'title')}
              </h2>
              <p className="text-sm text-cdl-muted">
                {tPackages(locale, 'packagesSectionSubtitle')}
              </p>
            </div>
            <Link
              href="/packages"
              className="text-sm font-semibold text-cdl-brand hover:underline"
            >
              {tPackages(locale, 'backToPackages')}
            </Link>
          </div>

          {packagesError ? (
            <pre className="rounded-2xl border border-red-500/40 bg-cdl-surface p-4 text-sm text-red-400">
              {packagesError}
            </pre>
          ) : (
            <section className="cdl-panel p-5 sm:p-7">
              <PackageImageUploadPanel packages={packages} />
            </section>
          )}
        </section>

        <section id="catalogo-itens" className="scroll-mt-24 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-cdl-title">
                {tPackages(locale, 'itemsTitle')}
              </h2>
              <p className="text-sm text-cdl-muted">
                {tPackages(locale, 'itemsSectionSubtitle')}
              </p>
            </div>
            <Link
              href="/additional-items"
              className="text-sm font-semibold text-cdl-brand hover:underline"
            >
              {tPackages(locale, 'backToItems')}
            </Link>
          </div>

          {catalogError ? (
            <pre className="rounded-2xl border border-red-500/40 bg-cdl-surface p-4 text-sm text-red-400">
              {catalogError}
            </pre>
          ) : (
            <section className="cdl-panel p-5 sm:p-7">
              <AdditionalItemImageUploadPanel items={items} />
            </section>
          )}
        </section>
      </div>
    </main>
  )
}
