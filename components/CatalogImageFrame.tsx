'use client'

import {
  normalizeCatalogItemPlaceholderType,
  type CatalogItemPlaceholderType,
} from '@/Lib/catalogItemVisual'
import { tCommon } from '@/Lib/i18n/common'
import { tPackages } from '@/Lib/i18n/packages'
import { useAuthLocaleFromMe } from '@/Lib/i18n/useAuthLocaleFromMe'

export type CatalogImageVariant = 'package' | 'catalogItem'

export type CatalogImageFrameSize = 'default' | 'thumbnail'

const FRAME_BG = 'bg-gradient-to-br from-neutral-100 to-neutral-50'

const VARIANT_FRAMES: Record<
  CatalogImageVariant,
  Record<CatalogImageFrameSize, string>
> = {
  package: {
    default:
      'aspect-square w-full min-h-[12rem] max-h-[min(85vw,28rem)] sm:min-h-[14rem] md:max-h-[22rem]',
    thumbnail: 'aspect-square h-16 w-16 min-h-0 max-h-16 shrink-0 rounded-lg',
  },
  catalogItem: {
    default:
      'aspect-[4/3] w-full min-h-[9rem] max-h-[min(70vw,16rem)] sm:min-h-[10rem] md:max-h-[13rem]',
    thumbnail: 'aspect-square h-14 w-14 min-h-0 max-h-14 shrink-0 rounded-lg',
  },
}

function joinClasses(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

function PlaceholderIcon({ itemType }: { itemType: CatalogItemPlaceholderType }) {
  const common = 'h-10 w-10 text-neutral-400 sm:h-12 sm:w-12'

  switch (itemType) {
    case 'SIDE':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden>
          <ellipse cx="12" cy="14" rx="8" ry="4" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M6 10c2-2 4-3 6-3s4 1 6 3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'PACKAGE_ITEM':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden>
          <path
            d="M4 8l8-4 8 4v8l-8 4-8-4V8z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M12 12v8M4 8l8 4 8-4" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )
    case 'SUPPLY':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden>
          <rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )
    case 'EQUIPMENT':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden>
          <path
            d="M8 10V7a4 4 0 118 0v3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <rect x="5" y="10" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )
    case 'PRODUCT':
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden>
          <path
            d="M6 14c0-3 2.5-6 6-6s6 3 6 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <ellipse cx="12" cy="15" rx="7" ry="4" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )
  }
}

export default function CatalogImageFrame({
  src,
  alt,
  variant = 'package',
  fallbackLabel,
  itemType,
  categoryPt,
  imageStatus,
  size = 'default',
  className,
  rounded = 'top',
}: {
  src?: string | null
  alt: string
  variant?: CatalogImageVariant
  fallbackLabel?: string
  itemType?: string | null
  categoryPt?: string | null
  imageStatus?: string | null
  size?: CatalogImageFrameSize
  className?: string
  rounded?: 'top' | 'all' | 'none'
}) {
  const locale = useAuthLocaleFromMe()
  const normalizedSrc = src?.trim() || null
  const placeholderType = normalizeCatalogItemPlaceholderType(itemType)
  const typeLabel =
    placeholderType === 'SIDE'
      ? tPackages(locale, 'typeSide')
      : placeholderType === 'PACKAGE_ITEM'
        ? tPackages(locale, 'typePackageItem')
        : placeholderType === 'SUPPLY'
          ? tPackages(locale, 'typeSupply')
          : placeholderType === 'EQUIPMENT'
            ? tPackages(locale, 'typeEquipment')
            : tPackages(locale, 'typeProduct')
  const label =
    fallbackLabel ??
    (variant === 'catalogItem'
      ? categoryPt?.trim() || typeLabel
      : tCommon(locale, 'packageImage'))
  const roundedClass =
    rounded === 'all'
      ? 'rounded-2xl'
      : rounded === 'top'
        ? 'rounded-t-2xl'
        : ''

  const showPendingBadge = imageStatus?.trim().toLowerCase() === 'missing'

  const frameClass = joinClasses(
    'relative flex w-full flex-col items-center justify-center gap-2 overflow-hidden',
    FRAME_BG,
    VARIANT_FRAMES[variant][size],
    roundedClass,
    className,
  )

  const pendingBadge = showPendingBadge ? (
    <span
      className={joinClasses(
        'absolute z-10 rounded-full bg-neutral-900/75 px-2 py-0.5 font-semibold uppercase tracking-wide text-white backdrop-blur-sm',
        size === 'thumbnail' ? 'bottom-1 right-1 text-[7px]' : 'bottom-2 right-2 text-[9px] sm:text-[10px]',
      )}
    >
      {tCommon(locale, 'photoPending')}
    </span>
  ) : null

  if (!normalizedSrc) {
    return (
      <div className={frameClass} role="img" aria-label={label}>
        {pendingBadge}
        {variant === 'catalogItem' ? <PlaceholderIcon itemType={placeholderType} /> : null}
        <span
          className={joinClasses(
            'px-2 text-center font-semibold text-neutral-500',
            size === 'thumbnail' ? 'text-[8px] leading-tight' : 'text-[10px] sm:text-xs',
            variant === 'catalogItem'
              ? 'uppercase tracking-wide'
              : 'uppercase tracking-wider text-cdl-faint',
          )}
        >
          {label}
        </span>
      </div>
    )
  }

  return (
    <div className={joinClasses(frameClass, 'bg-[#f7f7f7]')}>
      {pendingBadge}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={normalizedSrc}
        alt={alt}
        className="h-full w-full object-contain object-center"
        loading="lazy"
        decoding="async"
      />
    </div>
  )
}
