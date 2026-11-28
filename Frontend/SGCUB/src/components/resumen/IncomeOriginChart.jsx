import { useState } from 'react'
import { formatCount, formatMoney, formatPercentage, formatWholeMoney } from '../cuota/cuotaPeriod'
import DonutChart from '../shared/DonutChart'
import { legendItemProps } from '../shared/donutLegend'

const PARTS = [
  { key: 'cuotas', label: 'Cuotas', amountKey: 'cuotas', countKey: 'cantidad_cuotas', fill: 'bg-primary', stroke: 'stroke-primary' },
  { key: 'extra', label: 'Otros ingresos', amountKey: 'extra', countKey: 'cantidad_extra', fill: 'bg-chart-income', stroke: 'stroke-chart-income' },
]

const receiptsLabel = (count) => `${formatCount(count)} ${Number(count) === 1 ? 'comprobante' : 'comprobantes'}`

export default function IncomeOriginChart({ income }) {
  const [activeKey, setActiveKey] = useState(null)
  const total = Number(income.total)
  const share = (amount) => formatPercentage(total > 0 ? (Number(amount) / total) * 100 : 0)
  const parts = PARTS.map((part) => ({
    ...part,
    amount: Number(income[part.amountKey] ?? 0),
    count: Number(income[part.countKey] ?? 0),
  }))
  const segments = parts.map((part) => ({
    key: part.key,
    label: part.label,
    amount: part.amount,
    strokeClass: part.stroke,
    display: formatWholeMoney(part.amount),
    share: share(part.amount),
  }))
  const description = parts.map((part) => `${part.label} ${formatMoney(part.amount)} (${share(part.amount)})`).join(', ')

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <DonutChart
        segments={segments}
        total={total}
        caption="Total ingresado"
        label={`Ingresos del mes: total ${formatMoney(total)}. ${description}`}
        emptyLabel="Sin ingresos en el período"
        activeKey={activeKey}
        onActiveChange={setActiveKey}
      />

      <ul className="flex flex-col gap-2 min-w-0 w-full text-base">
        <li className="flex items-baseline gap-3 pb-2 border-b border-outline-variant/30">
          <span className="font-semibold text-on-surface">Total ingresado</span>
          <span className="ml-auto text-xl font-bold tabular-nums text-on-surface" title={formatMoney(total)}>{formatWholeMoney(total)}</span>
        </li>
        {parts.map((part) => {
          const interaction = legendItemProps(part.key, activeKey, setActiveKey)
          return (
            <li key={part.key} {...interaction} className={`${interaction.className} flex items-start gap-2.5 min-w-0`}>
              <span className={`mt-1.5 w-2.5 h-2.5 shrink-0 rounded-sm ${part.fill}`} aria-hidden="true" />
              <span className="flex-1 min-w-0 flex flex-col">
                <span className="text-on-surface">{part.label}</span>
                <span className="text-sm text-on-surface-variant tabular-nums">{receiptsLabel(part.count)} · {share(part.amount)}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-on-surface" title={formatMoney(part.amount)}>{formatWholeMoney(part.amount)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
