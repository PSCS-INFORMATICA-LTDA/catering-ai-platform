function isCdlTenant(slug: string, name: string): boolean {
  return slug === 'cdl' || /cdl/i.test(name)
}

/** Circular flaming-grill emblem already in the repo. Not a newly generated asset. */
export const CDL_FLAME_EMBLEM_SRC = '/cdl/logo.png'

export function publicQuoteEmblemSrc(
  slug: string,
  name: string,
  logoUrl: string | null,
): string | null {
  if (isCdlTenant(slug, name)) return CDL_FLAME_EMBLEM_SRC
  return logoUrl
}

export function PublicQuoteBrandLockup({
  slug,
  name,
  tagline,
}: {
  slug: string
  name: string
  tagline: string
}) {
  const cdl = isCdlTenant(slug, name)
  const fallbackName = name.replace(/\s+DEV$/i, '').trim()

  return (
    <div className="min-w-0" data-public-brand-lockup>
      {cdl ? (
        <>
          <p className="text-sm font-black leading-tight tracking-tight text-cdl-title">
            CDL Services
          </p>
          <p className="text-[11px] font-semibold leading-tight text-cdl-muted">
            Barbecue At Home
          </p>
        </>
      ) : (
        <p className="text-sm font-black leading-tight tracking-tight text-cdl-title">
          {fallbackName}
        </p>
      )}
      <p className="mt-0.5 text-[10px] font-medium tracking-wide text-cdl-faint">
        {tagline}
      </p>
    </div>
  )
}

export function publicQuoteCopyrightLine(slug: string, name: string, year: number) {
  if (isCdlTenant(slug, name)) {
    return `© ${year} CDL Services BBQ At Home`
  }
  return `© ${year} ${name.replace(/\s+DEV$/i, '').trim()}`
}
