import { useState } from 'react'
import { formatCount, formatPercentage } from '../cuota/cuotaPeriod'
import DonutChart from '../shared/DonutChart'
import { legendItemProps } from '../shared/donutLegend'
import { shareOf } from '../finanzas/cashFormat'
import { DOCUMENT_STATES } from './padronDocumental'

const SEGMENTS = [
  { key: DOCUMENT_STATES.VIGENTE, label: 'Vigentes', fill: 'bg-emerald-600', stroke: 'stroke-emerald-600' },
  { key: DOCUMENT_STATES.POR_VENCER, label: 'Próximos a vencer', fill: 'bg-amber-600', stroke: 'stroke-amber-600' },
  { key: DOCUMENT_STATES.VENCIDO, label: 'Vencidos', fill: 'bg-error', stroke: 'stroke-error' },
  { key: DOCUMENT_STATES.FALTANTE, label: 'Faltantes', fill: 'bg-outline', stroke: 'stroke-outline' },
]

export default function DocumentStatusChart({ counts }) {
  const [activeKey, setActiveKey] = useState(null)
  const total = SEGMENTS.reduce((sum, segment) => sum + counts[segment.key], 0)
  const segments = SEGMENTS.map((segment) => ({
    key: segment.key,
    label: segment.label,
    amount: counts[segment.key],
    strokeClass: segment.stroke,
    display: formatCount(counts[segment.key]),
    share: formatPercentage(shareOf(counts[segment.key], total)),
  }))

  return (
    <div className="min-w-0 h-full flex flex-col">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">Resumen de documentos</h3>
      <div className="mt-2 flex items-center gap-4">
        <DonutChart
          segments={segments}
          total={total}
          size={120}
          stroke={16}
          centerValue={formatCount(total)}
          label={`Resumen de documentos: ${segments.map((segment) => `${segment.display} ${segment.label.toLowerCase()}`).join(', ')}`}
          emptyLabel="No hay documentos obligatorios para jugadores activos ni docentes"
          activeKey={activeKey}
          onActiveChange={setActiveKey}
        />

        <ul className="flex-1 flex flex-col gap-1 min-w-0 text-sm">
          {segments.map((segment, index) => {
            const interaction = legendItemProps(segment.key, activeKey, setActiveKey)
            return (
              <li key={segment.key} {...interaction} className={`${interaction.className} flex items-center gap-2 min-w-0`}>
                <span className={`w-2.5 h-2.5 shrink-0 rounded-sm ${SEGMENTS[index].fill}`} aria-hidden="true" />
                <span className="flex-1 min-w-0 truncate text-on-surface-variant">{segment.label}</span>
                <span className="shrink-0 font-semibold tabular-nums text-on-surface">{segment.display}</span>
                <span className="shrink-0 w-14 text-right text-xs tabular-nums text-on-surface-variant">{segment.share}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
