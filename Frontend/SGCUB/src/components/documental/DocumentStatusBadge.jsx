const STATUS_STYLES = {
  vigente: { label: 'Vigente / Aprobado', badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-600' },
  por_vencer: { label: 'Por vencer', badge: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-600' },
  vencido: { label: 'Vencido', badge: 'bg-error-container text-error border border-error/20', dot: 'bg-error' },
  faltante: { label: 'Faltante', badge: 'bg-surface-container-high text-on-surface border border-dashed border-outline', dot: 'bg-outline' },
}

export default function DocumentStatusBadge({ status }) {
  const style = STATUS_STYLES[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-semibold ${style?.badge ?? ''}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style?.dot ?? ''}`} />
      {style?.label ?? 'Desconocido'}
    </span>
  )
}
