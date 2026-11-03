import { useState } from 'react'
import { formatCount, formatPercentage } from '../cuota/cuotaPeriod'
import { shareOf } from '../finanzas/cashFormat'
import { legendItemProps } from '../shared/donutLegend'
import DonutChart from '../shared/DonutChart'

const EDUCATION_LEVELS = [
  { key: 'primario_en_proceso', label: 'Primario en proceso', fill: 'bg-primary', strokeClass: 'stroke-primary' },
  { key: 'primario_incompleto', label: 'Primario incompleto', fill: 'bg-secondary', strokeClass: 'stroke-secondary' },
  { key: 'primario_completo', label: 'Primario completo', fill: 'bg-tertiary', strokeClass: 'stroke-tertiary' },
  { key: 'secundario_en_proceso', label: 'Secundario en proceso', fill: 'bg-emerald-600', strokeClass: 'stroke-emerald-600' },
  { key: 'secundario_incompleto', label: 'Secundario incompleto', fill: 'bg-amber-600', strokeClass: 'stroke-amber-600' },
  { key: 'secundario_completo', label: 'Secundario completo', fill: 'bg-sky-600', strokeClass: 'stroke-sky-600' },
  { key: 'universitario_en_proceso', label: 'Universitario en proceso', fill: 'bg-violet-600', strokeClass: 'stroke-violet-600' },
  { key: 'universitario_incompleto', label: 'Universitario incompleto', fill: 'bg-rose-600', strokeClass: 'stroke-rose-600' },
  { key: 'universitario_completo', label: 'Universitario completo', fill: 'bg-outline', strokeClass: 'stroke-outline' },
  { key: null, label: 'Sin especificar', fill: 'bg-outline-variant', strokeClass: 'stroke-outline-variant' },
]

export default function JugadorEducationChart({ jugadores, isLoading, error }) {
  const [activeKey, setActiveKey] = useState(null)
  const counts = EDUCATION_LEVELS.map((level) => ({
    ...level,
    amount: jugadores.filter((jugador) => (jugador.nivel_educacion ?? null) === level.key).length,
  }))
  const total = counts.reduce((sum, level) => sum + level.amount, 0)
  const segments = counts
    .filter((level) => level.amount > 0)
    .map((level) => ({
      ...level,
      key: level.key ?? 'sin_especificar',
      display: formatCount(level.amount),
      share: formatPercentage(shareOf(level.amount, total)),
    }))
  const description = segments.map((segment) => `${segment.label}: ${segment.display}`).join(', ')

  return (
    <section className="min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm p-5" aria-labelledby="jugador-education-title">
      <h2 id="jugador-education-title" className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">
        Nivel educativo de jugadores activos
      </h2>
      {isLoading ? (
        <p className="mt-4 text-sm text-on-surface-variant" role="status">Cargando distribución educativa...</p>
      ) : error ? (
        <p className="mt-4 text-sm text-error" role="alert">No se pudo cargar la distribución educativa de jugadores.</p>
      ) : (
        <div className="mt-4 flex flex-col lg:flex-row items-center gap-5">
          <DonutChart
            segments={segments}
            total={total}
            size={168}
            stroke={24}
            centerValue={formatCount(total)}
            caption="Jugadores"
            label={`Nivel educativo de jugadores: ${description || 'sin jugadores'}`}
            emptyLabel="No hay jugadores activos para mostrar"
            activeKey={activeKey}
            onActiveChange={setActiveKey}
          />
          {segments.length > 0 ? (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:flex-1 gap-x-6 gap-y-1 min-w-0 w-full text-sm">
              {segments.map((segment) => {
                const interaction = legendItemProps(segment.key, activeKey, setActiveKey)
                return (
                  <li
                    key={segment.key}
                    {...interaction}
                    className={`${interaction.className} flex items-center gap-2 min-w-0`}
                  >
                    <span className={`w-2.5 h-2.5 shrink-0 rounded-sm ${segment.fill}`} aria-hidden="true" />
                    <span className="flex-1 min-w-0 truncate text-on-surface" title={segment.label}>{segment.label}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-on-surface">{segment.display}</span>
                    <span className="shrink-0 w-14 text-right text-xs tabular-nums text-on-surface-variant">{segment.share}</span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-on-surface-variant">No hay jugadores activos para mostrar.</p>
          )}
        </div>
      )}
    </section>
  )
}
