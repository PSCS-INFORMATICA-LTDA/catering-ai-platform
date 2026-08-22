'use client'

import { tMedia } from '@/Lib/i18n/media'
import type { HeroDraft } from './HeroMediaCard'

const FRAMES = [
  { device: 'mobile' as const, aspect: 'aspect-[9/16]', label: 'previewMobile' as const },
  { device: 'tablet' as const, aspect: 'aspect-[3/4]', label: 'previewTablet' as const },
  { device: 'desktop' as const, aspect: 'aspect-[16/9]', label: 'previewDesktop' as const },
]

export default function HeroDeviceCompare({
  locale,
  draft,
  onClose,
}: {
  locale: string
  draft: HeroDraft
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black">{tMedia(locale, 'actionCompareDevices')}</h2>
          <button
            type="button"
            className="min-h-11 rounded-xl border border-cdl-border px-4 text-sm font-semibold"
            onClick={onClose}
          >
            {tMedia(locale, 'actionCancel')}
          </button>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {FRAMES.map((frame) => {
            const focus = draft.editor.applied[frame.device]
            return (
              <figure key={frame.device} className="space-y-2">
                <figcaption className="text-xs font-bold uppercase tracking-wide text-cdl-muted">
                  {tMedia(locale, frame.label)}
                </figcaption>
                <div className={`overflow-hidden rounded-2xl bg-neutral-900 ${frame.aspect}`}>
                  {draft.mediaUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={draft.mediaUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      style={{
                        objectPosition: `${Math.round(focus.x * 100)}% ${Math.round(focus.y * 100)}%`,
                      }}
                    />
                  ) : null}
                </div>
              </figure>
            )
          })}
        </div>
      </div>
    </div>
  )
}
