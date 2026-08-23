export default function PublicRequiredMark({
  label,
}: {
  label: string
}) {
  return (
    <span
      data-public-required
      className="public-field-required"
      title={label}
      aria-label={label}
    >
      *
    </span>
  )
}
