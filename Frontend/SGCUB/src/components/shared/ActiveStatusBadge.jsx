const STYLES = {
  active: 'font-semibold bg-emerald-50 text-emerald-700 border-emerald-200',
  inactive: 'font-medium bg-surface-container-high text-on-surface-variant border-outline-variant/30',
}

export default function ActiveStatusBadge({ isActive, label }) {
  const style = isActive ? STYLES.active : STYLES.inactive
  const text = label ?? (isActive ? 'Activo' : 'Inactivo')
  const multiline = text.includes('\n')
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-sm border whitespace-nowrap ${multiline ? 'rounded-lg' : 'rounded-full'} ${style}`}>
      <span className={multiline ? 'whitespace-pre-line leading-tight py-0.5' : undefined}>{text}</span>
    </span>
  )
}
