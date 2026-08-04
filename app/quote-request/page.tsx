import Link from 'next/link'

export const dynamic = 'force-dynamic'

/**
 * Placeholder para fluxo público de solicitação de cotação.
 * TODO: integrar com resolve-by-phone, wizard simplificado e i18n PT/EN/ES.
 */
export default function QuoteRequestPage() {
  return (
    <main className="min-h-screen bg-cdl-bg px-4 py-8 text-cdl-fg sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="text-2xl font-black text-cdl-title sm:text-3xl">
            Solicitar cotação
          </h1>
          <p className="mt-2 text-sm text-cdl-muted">
            Portal público em preparação. Em breve: idioma, telefone e dados do
            evento para iniciar uma cotação personalizada.
          </p>
        </header>

        <section className="cdl-panel space-y-4 p-6">
          <p className="text-sm text-cdl-muted">
            Estrutura planejada para esta fase:
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm text-cdl-muted">
            <li>Seleção de idioma (PT / EN / ES)</li>
            <li>Identificação por telefone (chave do cliente)</li>
            <li>Dados básicos do evento</li>
            <li>Encaminhamento para revisão interna ou wizard</li>
          </ul>
          <p className="text-xs italic text-cdl-muted">
            TODO: implementar formulário público completo na próxima fase.
          </p>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/quotes/new"
            className="cdl-btn-primary inline-flex min-h-[44px] items-center justify-center rounded-xl px-5 py-3 text-sm font-bold"
          >
            Nova cotação (equipe)
          </Link>
          <Link
            href="/customer-quote"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-cdl-border bg-cdl-surface px-5 py-3 text-sm font-bold text-cdl-fg"
          >
            Ver página do cliente
          </Link>
        </div>
      </div>
    </main>
  )
}
