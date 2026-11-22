const STATES = {
  vencido: { label: 'Vencida', className: 'text-error font-semibold' },
  faltante: { label: 'Incompleta', className: 'text-error font-semibold' },
  por_vencer: { label: 'Por vencer', className: 'text-amber-700 font-semibold' },
  vigente: { label: 'Al día', className: 'text-on-surface-variant' },
}

const plural = (count, singular, pluralForm) => `${count} ${count === 1 ? singular : pluralForm}`

const detailOf = (documentacion) => [
  documentacion.vencidos > 0 && plural(documentacion.vencidos, 'vencido', 'vencidos'),
  documentacion.faltantes > 0 && plural(documentacion.faltantes, 'faltante', 'faltantes'),
  documentacion.por_vencer > 0 && plural(documentacion.por_vencer, 'por vencer', 'por vencer'),
].filter(Boolean).join(' · ')

export default function DocumentationStatus({ documentacion }) {
  const state = STATES[documentacion?.estado]
  if (!state) return <span className="text-on-surface-variant">—</span>

  const detail = detailOf(documentacion)
  return (
    <span className="inline-flex flex-col leading-tight">
      <span className={state.className}>{state.label}</span>
      {detail && <span className="text-sm text-on-surface-variant tabular-nums">{detail}</span>}
    </span>
  )
}
