import { useState } from 'react'
import { formatCount, formatMoney, formatWholeMoney } from '../cuota/cuotaPeriod'
import AffectedCategoriesModal from './AffectedCategoriesModal'

const TOP_COUNT = 3
const LINK_BUTTON_CLASS = 'inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded'

const plural = (count) => `${formatCount(count)} ${count === 1 ? 'moroso' : 'morosos'}`

function CategoryBar({ category, maxAmount }) {
  const share = maxAmount > 0 ? (Number(category.monto) / maxAmount) * 100 : 0
  return (
    <li className="flex flex-col gap-1 min-w-0">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-semibold text-on-surface" title={category.nombre}>{category.nombre}</span>
        <span className="shrink-0 text-on-surface-variant">
          {plural(category.morosos)} · <span className="font-semibold text-on-surface tabular-nums" title={formatMoney(category.monto)}>{formatWholeMoney(category.monto)}</span>
        </span>
      </div>
      <div className="h-2 rounded bg-surface-container-high" aria-hidden="true">
        <div className="h-full rounded bg-error" style={{ width: `${share}%` }} />
      </div>
    </li>
  )
}

export default function AffectedCategories({ categories }) {
  const [opened, setOpened] = useState(false)
  const top = categories.slice(0, TOP_COUNT)
  const maxAmount = Number(top[0]?.monto ?? 0)

  return (
    <div className="min-w-0 h-full flex flex-col sm:col-span-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">Categorías más afectadas</h3>
        {categories.length > 0 && (
          <button type="button" onClick={() => setOpened(true)} className={LINK_BUTTON_CLASS}>
            Ver todas
            <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">open_in_new</span>
          </button>
        )}
      </div>
      {top.length === 0 ? (
        <p className="mt-2 text-sm text-on-surface-variant">Ninguna categoría registra deuda vencida.</p>
      ) : (
        <ol className="mt-2 flex flex-col gap-3">
          {top.map((category) => <CategoryBar key={category.nombre} category={category} maxAmount={maxAmount} />)}
        </ol>
      )}
      <AffectedCategoriesModal opened={opened} onClose={() => setOpened(false)} categories={categories} />
    </div>
  )
}
