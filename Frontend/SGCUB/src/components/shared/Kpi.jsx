const GRID_CLASSES = {
  3: 'sm:grid-cols-3 sm:gap-0 sm:divide-x sm:[&>*]:px-6 sm:[&>*:first-child]:pl-0 sm:[&>*:last-child]:pr-0',
  4: 'sm:grid-cols-2 xl:grid-cols-4 xl:gap-0 xl:divide-x xl:[&>*]:px-6 xl:[&>*:first-child]:pl-0 xl:[&>*:last-child]:pr-0',
}

export function KpiGrid({ columns = 4, className = '', children }) {
  return (
    <div className={`grid grid-cols-1 gap-6 divide-outline-variant/40 ${GRID_CLASSES[columns]} ${className}`}>
      {children}
    </div>
  )
}

export function KpiColumn({ label, value, title, tone = 'text-on-surface', caption }) {
  return (
    <div className="min-w-0 flex flex-col mt-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">{label}</h3>
      <p className={`mt-1 text-2xl font-bold tabular-nums leading-tight ${tone}`} title={title}>{value}</p>
      {caption && <p className="mt-1 text-sm text-on-surface-variant">{caption}</p>}
    </div>
  )
}
