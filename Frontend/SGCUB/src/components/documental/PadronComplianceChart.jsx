import { useState } from 'react'
import { formatCount, formatPercentage } from '../cuota/cuotaPeriod'
import DonutChart from '../shared/DonutChart'
import { legendItemProps } from '../shared/donutLegend'
import { shareOf } from '../finanzas/cashFormat'
import { PROFILES } from './padronDocumental'

const SEGMENTS = [
  { key: 'habilitados', label: 'Habilitados', fill: 'bg-emerald-600', stroke: 'stroke-emerald-600' },
  { key: 'inhabilitados', label: 'Inhabilitados', fill: 'bg-error', stroke: 'stroke-error' },
]

const BREAKDOWN = [
  { key: PROFILES.JUGADOR, label: 'Jugadores activos' },
  { key: PROFILES.DOCENTE, label: 'Docentes' },
]

export default function PadronComplianceChart({ resumen }) {
  const [activeKey, setActiveKey] = useState(null)
  const segments = SEGMENTS.map((segment) => ({
    key: segment.key,
    label: segment.label,
    amount: resumen[segment.key],
    strokeClass: segment.stroke,
    display: formatCount(resumen[segment.key]),
    share: formatPercentage(shareOf(resumen[segment.key], resumen.total)),
  }))

  return (
    <div className="min-w-0 h-full flex flex-col">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">Resumen del padrón</h3>
      <div className="mt-2 flex items-center gap-4">
        <DonutChart
          segments={segments}
          total={resumen.total}
          size={120}
          stroke={16}
          centerValue={formatPercentage(resumen.cumplimiento)}
          label={`Resumen del padrón: ${formatCount(resumen.habilitados)} habilitados y ${formatCount(resumen.inhabilitados)} inhabilitados`}
          emptyLabel="Sin jugadores activos ni docentes en el padrón"
          activeKey={activeKey}
          onActiveChange={setActiveKey}
        />

        <ul className="flex flex-col gap-1 min-w-0 text-sm">
          {SEGMENTS.map((segment) => {
            const interaction = legendItemProps(segment.key, activeKey, setActiveKey)
            return (
              <li key={segment.key} {...interaction} className={`${interaction.className} flex items-center gap-2 min-w-0`}>
                <span className={`w-2.5 h-2.5 shrink-0 rounded-sm ${segment.fill}`} aria-hidden="true" />
                <span className="text-on-surface-variant">{segment.label}</span>
                <span className="font-semibold tabular-nums text-on-surface">{formatCount(resumen[segment.key])}</span>
              </li>
            )
          })}
          <li>
            <ul className="ml-1 pl-3 border-l border-outline-variant/40 flex flex-col gap-0.5" aria-label="Inhabilitados por perfil">
              {BREAKDOWN.map((item) => (
                <li key={item.key} className="flex items-center gap-2 text-xs">
                  <span className="text-on-surface-variant">{item.label}</span>
                  <span className="font-semibold tabular-nums text-error">{formatCount(resumen.inhabilitados_por_perfil[item.key])}</span>
                </li>
              ))}
            </ul>
          </li>
        </ul>
      </div>
    </div>
  )
}
