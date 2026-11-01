import { useState } from 'react'
import { formatPercentage, formatWholeMoney } from '../cuota/cuotaPeriod'
import DonutChart from '../shared/DonutChart'
import { legendItemProps } from '../shared/donutLegend'
import { SEGMENT_COLORS } from './chartFormat'

// Ring chart of where the month's income came from: cuotas, the main concepts and the rest grouped
export default function IncomeOriginChart({ income }) {
  const [activeKey, setActiveKey] = useState(null)
  const total = Number(income.total)
  const segments = income.origen.map((segment, index) => ({
    key: segment.nombre,
    label: segment.nombre,
    amount: segment.monto,
    strokeClass: SEGMENT_COLORS[index % SEGMENT_COLORS.length].stroke,
    display: formatWholeMoney(segment.monto),
    share: formatPercentage(segment.porcentaje),
  }))
  const description = income.origen
    .filter((segment) => Number(segment.monto) > 0)
    .map((segment) => `${segment.nombre} ${formatPercentage(segment.porcentaje)}`)
    .join(', ')

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <DonutChart
        segments={segments}
        total={total}
        caption="Total ingresado"
        label={`Origen de los ingresos: ${description}`}
        emptyLabel="Sin ingresos en el período"
        activeKey={activeKey}
        onActiveChange={setActiveKey}
      />

      <ul className="flex flex-col gap-1 min-w-0 w-full">
        {income.origen.map((segment, index) => {
          const interaction = legendItemProps(segment.nombre, activeKey, setActiveKey)
          return (
            <li key={segment.nombre} {...interaction} className={`${interaction.className} flex items-center gap-2 min-w-0 text-sm`}>
              <span className={`w-2.5 h-2.5 shrink-0 rounded-sm ${SEGMENT_COLORS[index % SEGMENT_COLORS.length].fill}`} aria-hidden="true" />
              <span className="flex-1 min-w-0 truncate text-on-surface" title={segment.nombre}>{segment.nombre}</span>
              <span className="shrink-0 font-semibold tabular-nums text-on-surface">{formatPercentage(segment.porcentaje)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
