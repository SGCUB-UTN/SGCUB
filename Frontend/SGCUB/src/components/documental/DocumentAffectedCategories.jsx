import useEntered from '../../hooks/useEntered'
import { formatCount, formatPercentage } from '../cuota/cuotaPeriod'
import { ROW_HOVER, WIDTH_MOTION, grown } from '../shared/chartMotion'
import { shareOf } from '../finanzas/cashFormat'

const LIST_HEIGHT_CLASS = 'max-h-[10.75rem]'

function CategoryBar({ category, onSelect }) {
  const entered = useEntered()
  const share = shareOf(category.inhabilitados, category.total)
  return (
    <li className="flex shrink-0">
      <button
        type="button"
        onClick={() => onSelect(category.categoria_id)}
        title={`Ver los documentos de ${category.categoria} en la tabla`}
        className={`flex-1 min-w-0 flex flex-col gap-1 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${ROW_HOVER}`}
      >
        <span className="flex items-baseline justify-between gap-3 text-sm">
          <span className="min-w-0 truncate font-semibold text-on-surface">{category.categoria}</span>
          <span className="shrink-0 text-on-surface-variant">
            <span className="font-semibold text-error tabular-nums">{formatCount(category.inhabilitados)}</span>
            {` de ${formatCount(category.total)} · ${formatPercentage(share)}`}
          </span>
        </span>
        <span className="block h-2 rounded bg-emerald-600" aria-hidden="true">
          <span className={`block h-full rounded bg-error ${WIDTH_MOTION}`} style={{ width: grown(entered, `${share}%`) }} />
        </span>
      </button>
    </li>
  )
}

export default function DocumentAffectedCategories({ categories, onSelect }) {
  return (
    <div className="min-w-0 h-full flex flex-col">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">Categorías más afectadas</h3>
      {categories.length === 0 ? (
        <p className="mt-2 text-sm text-on-surface-variant">Ninguna categoría tiene jugadores o docentes inhabilitados.</p>
      ) : (
        <ol className={`mt-1 -mx-2 pl-2 pr-3 flex flex-col gap-1 overflow-y-auto thin-scroll ${LIST_HEIGHT_CLASS}`} aria-label="Inhabilitados por categoría">
          {categories.map((category) => <CategoryBar key={category.categoria_id} category={category} onSelect={onSelect} />)}
        </ol>
      )}
    </div>
  )
}
