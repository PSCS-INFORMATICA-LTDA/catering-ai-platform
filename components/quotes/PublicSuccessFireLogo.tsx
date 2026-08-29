'use client'

export default function PublicSuccessFireLogo({
  src,
  alt,
}: {
  src: string
  alt: string
}) {
  return (
    <section
      data-success-fire-logo
      className="public-success-fire-logo"
      aria-label={alt}
    >
      <div className="public-success-fire-logo-stage" aria-hidden>
        <span className="public-success-fire-logo-halo" />
        <span className="public-success-fire-logo-embers" />
        <span className="public-success-fire-logo-flame public-success-fire-logo-flame--left" />
        <span className="public-success-fire-logo-flame public-success-fire-logo-flame--right" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          data-success-fire-logo-mark
          src={src}
          alt=""
          className="public-success-fire-logo-mark"
        />
      </div>
    </section>
  )
}
