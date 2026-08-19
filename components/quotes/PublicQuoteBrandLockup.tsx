function isCdlTenant(slug: string, name: string): boolean {
  return slug === 'cdl' || /cdl/i.test(name)
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
          <p className="truncate text-sm font-black leading-tight tracking-tight text-cdl-title">
            CDL Services
          </p>
          <p className="truncate text-[11px] font-semibold leading-tight text-cdl-muted">
            Barbecue At Home
          </p>
        </>
      ) : (
        <p className="truncate text-sm font-black leading-tight tracking-tight text-cdl-title">
          {fallbackName}
        </p>
      )}
      <p className="mt-0.5 truncate text-[10px] font-medium tracking-wide text-cdl-faint">
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
