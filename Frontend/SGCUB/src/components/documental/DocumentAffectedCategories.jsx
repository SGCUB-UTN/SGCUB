import useEntered from '../../hooks/useEntered'
import { formatCount, formatPercentage } from '../cuota/cuotaPeriod'
import { ROW_HOVER, WIDTH_MOTION, grown } from '../shared/chartMotion'
import { shareOf } from '../finanzas/cashFormat'

function CategoryBar({ category }) {
  const entered = useEntered()
  const share = shareOf(category.inhabilitados, category.total)
  return (
    <li className={`flex flex-col gap-1 min-w-0 ${ROW_HOVER}`}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-semibold text-on-surface" title={category.categoria}>{category.categoria}</span>
        <span className="shrink-0 text-on-surface-variant">
          <span className="font-semibold text-error tabular-nums">{formatCount(category.inhabilitados)}</span>
          {` de ${formatCount(category.total)} · ${formatPercentage(share)}`}
        </span>
      </div>
      <div className="h-2 rounded bg-surface-container-high" aria-hidden="true">
        <div className={`h-full rounded bg-error ${WIDTH_MOTION}`} style={{ width: grown(entered, `${share}%`) }} />
      </div>
    </li>
  )
}

export default function DocumentAffectedCategories({ categories }) {
  return (
    <div className="min-w-0 h-full flex flex-col">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">Categorías más afectadas</h3>
      {categories.length === 0 ? (
        <p className="mt-2 text-sm text-on-surface-variant">Ninguna categoría tiene jugadores o docentes inhabilitados.</p>
      ) : (
        <ol className="mt-1 flex flex-col gap-1" aria-label="Inhabilitados por categoría">
          {categories.map((category) => <CategoryBar key={category.categoria_id} category={category} />)}
        </ol>
      )}
    </div>
  )
}
