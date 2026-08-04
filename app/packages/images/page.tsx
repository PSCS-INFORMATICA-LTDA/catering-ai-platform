import Link from 'next/link'
import AdditionalItemImageUploadPanel from '@/components/AdditionalItemImageUploadPanel'
import PackageImageUploadPanel from '@/components/PackageImageUploadPanel'
import { fetchCatalogItems } from '@/Lib/fetchCatalogItems'
import type { CatalogItemListItem } from '@/Lib/fetchCatalogItems'
import { supabase } from '@/Lib/supabase'

export default async function CatalogImagesPage() {
  const [packagesRes, catalogRes] = await Promise.all([
    supabase
      .from('packages')
      .select('id, package_key, package_name, label_pt, image_url')
      .eq('active', true)
      .order('display_order', { ascending: true }),
    fetchCatalogItems({ activeOnly: true, audience: 'admin', withCurrentPrices: false }),
  ])

  const packagesError = packagesRes.error?.message ?? null
  const catalogError = catalogRes.error?.message ?? null

  return (
    <main className="text-cdl-fg">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <h1 className="text-2xl font-black text-cdl-title">Imagens do catálogo</h1>
          <p className="mt-1 text-sm text-cdl-muted">
            Upload de imagens para pacotes e itens do catálogo.
          </p>
        </div>

        <nav className="flex flex-wrap gap-2">
          <a
            href="#pacotes"
            className="inline-flex min-h-[40px] items-center rounded-xl border border-cdl-border bg-cdl-surface px-4 py-2 text-xs font-bold uppercase tracking-wider text-cdl-fg hover:border-cdl-accent-border"
          >
            Pacotes
          </a>
          <a
            href="#catalogo-itens"
            className="inline-flex min-h-[40px] items-center rounded-xl border border-cdl-border bg-cdl-surface px-4 py-2 text-xs font-bold uppercase tracking-wider text-cdl-fg hover:border-cdl-accent-border"
          >
            Cadastro de itens
          </a>
        </nav>

        <section id="pacotes" className="scroll-mt-24 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-cdl-title">Pacotes</h2>
              <p className="text-sm text-cdl-muted">
                Imagens exibidas na seleção de pacotes do wizard.
              </p>
            </div>
            <Link
              href="/packages"
              className="text-sm font-semibold text-cdl-brand hover:underline"
            >
              ← Voltar aos pacotes
            </Link>
          </div>

          {packagesError ? (
            <pre className="rounded-2xl border border-red-500/40 bg-cdl-surface p-4 text-sm text-red-400">
              {packagesError}
            </pre>
          ) : (
            <section className="cdl-panel p-5 sm:p-7">
              <PackageImageUploadPanel packages={packagesRes.data ?? []} />
            </section>
          )}
        </section>

        <section id="catalogo-itens" className="scroll-mt-24 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-cdl-title">
                Cadastro de itens
              </h2>
              <p className="text-sm text-cdl-muted">
                Imagens exibidas no cadastro de itens e na etapa de adicionais da cotação.
              </p>
            </div>
            <Link
              href="/additional-items"
              className="text-sm font-semibold text-cdl-brand hover:underline"
            >
              ← Voltar ao cadastro de itens
            </Link>
          </div>

          {catalogError ? (
            <pre className="rounded-2xl border border-red-500/40 bg-cdl-surface p-4 text-sm text-red-400">
              {catalogError}
            </pre>
          ) : (
            <section className="cdl-panel p-5 sm:p-7">
              <AdditionalItemImageUploadPanel
                items={(catalogRes.data ?? []) as unknown as CatalogItemListItem[]}
              />
            </section>
          )}
        </section>
      </div>
    </main>
  )
}
