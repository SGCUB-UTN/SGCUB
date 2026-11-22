import { DOCUMENTATION_LABELS } from './documentationStates'

const STATE_CLASSES = {
  vencido: 'text-error font-semibold',
  faltante: 'text-error font-semibold',
  por_vencer: 'text-amber-700 font-semibold',
  vigente: 'text-on-surface-variant',
}

const plural = (count, singular, pluralForm) => `${count} ${count === 1 ? singular : pluralForm}`

const detailOf = (documentacion) => [
  documentacion.vencidos > 0 && plural(documentacion.vencidos, 'vencido', 'vencidos'),
  documentacion.faltantes > 0 && plural(documentacion.faltantes, 'faltante', 'faltantes'),
  documentacion.por_vencer > 0 && plural(documentacion.por_vencer, 'por vencer', 'por vencer'),
].filter(Boolean).join(' · ')

export default function DocumentationStatus({ documentacion }) {
  const label = DOCUMENTATION_LABELS[documentacion?.estado]
  if (!label) return <span className="text-on-surface-variant">—</span>

  const detail = detailOf(documentacion)
  return (
    <span className="inline-flex flex-col leading-tight">
      <span className={STATE_CLASSES[documentacion.estado]}>{label}</span>
      {detail && <span className="text-sm text-on-surface-variant tabular-nums">{detail}</span>}
    </span>
  )
}
