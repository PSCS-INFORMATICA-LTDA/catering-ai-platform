/** Marca de produto sugerida (vídeo II) — Food AI Platform, estilo Logistics. */

export function FoodAiPlatformMark({
  compact = false,
  className = '',
}: {
  compact?: boolean
  className?: string
}) {
  if (compact) {
    return (
      <span
        className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-xs font-black tracking-tight text-white ${className}`}
        title="Food AI Platform"
      >
        F
      </span>
    )
  }

  return (
    <div className={`flex min-w-0 flex-col gap-0.5 ${className}`}>
      <span className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-amber-300/90">
        Food AI
      </span>
      <span className="truncate text-sm font-black tracking-tight text-white">
        Platform
      </span>
      <span className="truncate text-[0.65rem] text-white/45">
        by PSCS · Catering
      </span>
    </div>
  )
}
