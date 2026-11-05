import useEntered from '../../hooks/useEntered'
import { formatCount, formatMoney, formatWholeMoney } from '../cuota/cuotaPeriod'
import { ROW_HOVER, WIDTH_MOTION, grown } from '../shared/chartMotion'

const LIST_HEIGHT_CLASS = 'max-h-[8rem]'

const plural = (count) => `${formatCount(count)} ${count === 1 ? 'moroso' : 'morosos'}`

function CategoryBar({ category, maxAmount }) {
  const entered = useEntered()
  const share = maxAmount > 0 ? (Number(category.monto) / maxAmount) * 100 : 0
  return (
    <li className={`flex shrink-0 flex-col gap-1 min-w-0 ${ROW_HOVER}`}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-semibold text-on-surface" title={category.nombre}>{category.nombre}</span>
        <span className="shrink-0 text-on-surface-variant">
          {plural(category.morosos)} · <span className="font-semibold text-on-surface tabular-nums" title={formatMoney(category.monto)}>{formatWholeMoney(category.monto)}</span>
        </span>
      </div>
      <div className="h-2 rounded bg-surface-container-high" aria-hidden="true">
        <div className={`h-full rounded bg-error ${WIDTH_MOTION}`} style={{ width: grown(entered, `${share}%`) }} />
      </div>
    </li>
  )
}

export default function AffectedCategories({ categories }) {
  const maxAmount = Math.max(0, ...categories.map((category) => Number(category.monto)))

  return (
    <div className="min-w-0 h-full flex flex-col">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">Categorías más afectadas</h3>
      {categories.length === 0 ? (
        <p className="mt-2 text-sm text-on-surface-variant">Ninguna categoría registra deuda vencida.</p>
      ) : (
        <ol className={`mt-1 -mx-2 pl-2 pr-3 flex flex-col gap-1 overflow-y-auto thin-scroll ${LIST_HEIGHT_CLASS}`} aria-label="Deuda vencida por categoría">
          {categories.map((category) => <CategoryBar key={category.nombre} category={category} maxAmount={maxAmount} />)}
        </ol>
      )}
    </div>
  )
}
