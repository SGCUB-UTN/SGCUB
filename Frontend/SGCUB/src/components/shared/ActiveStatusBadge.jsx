const STYLES = {
  active: { badge: 'font-semibold bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-600' },
  inactive: { badge: 'font-medium bg-surface-container-high text-on-surface-variant border-outline-variant/30', dot: 'bg-outline' },
}

export default function ActiveStatusBadge({ isActive, label }) {
  const style = isActive ? STYLES.active : STYLES.inactive
  const text = label ?? (isActive ? 'Activo' : 'Inactivo')
  const multiline = text.includes('\n')
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-sm border whitespace-nowrap ${multiline ? 'rounded-lg' : 'rounded-full'} ${style.badge}`}>
      <span className={`w-1.5 h-1.5 mx-1 rounded-full shrink-0 ${style.dot}`} />
      <span className={multiline ? 'whitespace-pre-line leading-tight py-0.5' : undefined}>{text}</span>
    </span>
  )
}
