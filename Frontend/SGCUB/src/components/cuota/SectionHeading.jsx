export default function SectionHeading({ id, title, description, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 sm:gap-4">
      <div className="min-w-0">
        <h2 id={id} className="text-base font-semibold text-on-surface uppercase tracking-wider">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-on-surface-variant">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
