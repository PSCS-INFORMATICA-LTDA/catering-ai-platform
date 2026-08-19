'use client'

export default function PackageCatalogHeroArt({
  name,
  image,
}: {
  name: string
  image: string | null
}) {
  return (
    <span className="@container relative block w-full min-w-0">
      {image ? (
        // Keep the flyer’s natural ratio. Do not crop, letterbox, or overlay
        // commercial price / sides copy — pricing lives below the art.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={name}
          className="block h-auto w-full"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="flex min-h-40 w-full items-center justify-center bg-gradient-to-br from-stone-200 to-stone-100 px-4 py-10 text-center text-base font-bold text-stone-600">
          {name}
        </span>
      )}
    </span>
  )
}
