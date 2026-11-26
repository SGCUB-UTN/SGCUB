import { useState } from 'react'
import { formatCount, formatPercentage } from '../cuota/cuotaPeriod'
import DonutChart from '../shared/DonutChart'
import { legendItemProps } from '../shared/donutLegend'
import { shareOf } from '../finanzas/cashFormat'
import { PROFILES, SITUATIONS, countBySituation } from './padronDocumental'

const SEGMENTS = [
  { key: SITUATIONS.INHABILITADA, label: 'Inhabilitados', fill: 'bg-error', stroke: 'stroke-error', title: 'Ver las personas inhabilitadas en la tabla' },
  { key: SITUATIONS.POR_VENCER, label: 'Por vencer', fill: 'bg-amber-500', stroke: 'stroke-amber-500', title: 'Ver las personas con documentos por vencer en la tabla' },
  { key: SITUATIONS.AL_DIA, label: 'Al día', fill: 'bg-emerald-600', stroke: 'stroke-emerald-600', title: 'Ver las personas al día en la tabla' },
]

const plural = (count, singular, pluralForm) => `${formatCount(count)} ${count === 1 ? singular : pluralForm}`

export default function PadronComplianceChart({ rows, onSelect }) {
  const [activeKey, setActiveKey] = useState(null)
  const total = rows.length
  const counts = Object.fromEntries(SEGMENTS.map((segment) => [segment.key, countBySituation(rows, segment.key)]))
  const inhabilitados = counts[SITUATIONS.INHABILITADA]
  const habilitados = total - inhabilitados
  const disabledBy = (perfil) => rows.filter((row) => row.perfil === perfil && row.situacion === SITUATIONS.INHABILITADA).length
  const jugadores = disabledBy(PROFILES.JUGADOR)
  const docentes = disabledBy(PROFILES.DOCENTE)

  const segments = SEGMENTS.map((segment) => ({
    key: segment.key,
    label: segment.label,
    amount: counts[segment.key],
    strokeClass: segment.stroke,
    display: formatCount(counts[segment.key]),
    share: formatPercentage(shareOf(counts[segment.key], total)),
  }))

  return (
    <div className="min-w-0 flex flex-col gap-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">Resumen del padrón</h3>

      <div className="flex items-center gap-5">
        <DonutChart
          segments={segments}
          total={total}
          size={112}
          stroke={14}
          centerValue={formatPercentage(shareOf(habilitados, total))}
          caption="habilitados"
          label={`Resumen del padrón: ${formatCount(inhabilitados)} inhabilitados y ${formatCount(habilitados)} habilitados de ${formatCount(total)} personas`}
          emptyLabel="Sin jugadores activos ni docentes en el padrón"
          activeKey={activeKey}
          onActiveChange={setActiveKey}
          onSelect={onSelect}
        />
        <div className="min-w-0 flex flex-col gap-1">
          <p className="text-base text-on-surface">
            <span className={`text-2xl font-bold tabular-nums ${inhabilitados > 0 ? 'text-error' : 'text-on-surface'}`}>{formatCount(inhabilitados)}</span>
            {' '}{inhabilitados === 1 ? 'inhabilitado' : 'inhabilitados'}
            <span className="text-on-surface-variant"> de {plural(total, 'persona', 'personas')}</span>
          </p>
          {inhabilitados > 0 && (
            <p className="text-base text-on-surface-variant">
              {plural(jugadores, 'jugador activo', 'jugadores activos')} · {plural(docentes, 'docente', 'docentes')}
            </p>
          )}
        </div>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-base" aria-label="Personas por situación documental">
        {SEGMENTS.map((segment) => {
          const interaction = legendItemProps(segment.key, activeKey, setActiveKey)
          return (
            <li key={segment.key}>
              <button
                type="button"
                {...interaction}
                onClick={() => onSelect(segment.key)}
                title={segment.title}
                className={`${interaction.className} !cursor-pointer inline-flex items-center gap-2`}
              >
                <span className={`w-2.5 h-2.5 shrink-0 rounded-sm ${segment.fill}`} aria-hidden="true" />
                <span className="text-on-surface">{segment.label}</span>
                <span className="font-semibold tabular-nums text-on-surface">{formatCount(counts[segment.key])}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
