import { useState } from 'react'
import useEntered from '../../hooks/useEntered'
import { formatCount } from '../cuota/cuotaPeriod'
import { ROW_HOVER, WIDTH_MOTION, grown } from '../shared/chartMotion'
import { TEXT_BUTTON_CLASS } from '../shared/textButton'
import { shareOf } from '../finanzas/cashFormat'

const PREVIEW_COUNT = 3

const SEGMENTS = [
  { key: 'inhabilitadas', label: 'Inhabilitados', fill: 'bg-error', text: 'text-error' },
  { key: 'porVencer', label: 'Por vencer', fill: 'bg-amber-500', text: 'text-amber-700' },
]

const LEGEND = [...SEGMENTS, { key: 'alDia', label: 'Al día', fill: 'bg-emerald-600' }]

const summaryOf = (category) => SEGMENTS
  .filter((segment) => category[segment.key] > 0)
  .map((segment) => `${formatCount(category[segment.key])} ${segment.label.toLowerCase()}`)
  .join(' y ')

function CategoryBar({ category, onSelect }) {
  const entered = useEntered()
  const segments = SEGMENTS.filter((segment) => category[segment.key] > 0)
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(category.categoria_id)}
        aria-label={`${category.categoria}: ${summaryOf(category)} de ${formatCount(category.total)} personas. Ver en la tabla`}
        className={`w-full flex flex-col gap-1.5 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${ROW_HOVER}`}
      >
        <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-base">
          <span className="min-w-0 font-semibold text-on-surface">{category.categoria}</span>
          <span className="text-on-surface-variant">
            {segments.map((segment, index) => (
              <span key={segment.key}>
                {index > 0 && ' · '}
                <span className={`font-semibold tabular-nums ${segment.text}`}>{formatCount(category[segment.key])}</span>
                {` ${segment.label.toLowerCase()}`}
              </span>
            ))}
            {' de '}
            <span className="tabular-nums">{formatCount(category.total)}</span>
          </span>
        </span>
        <span className="flex h-2 overflow-hidden rounded bg-emerald-600" aria-hidden="true">
          {segments.map((segment) => (
            <span
              key={segment.key}
              className={`block h-full ${segment.fill} ${WIDTH_MOTION}`}
              style={{ width: grown(entered, `${shareOf(category[segment.key], category.total)}%`) }}
            />
          ))}
        </span>
      </button>
    </li>
  )
}

export default function DocumentAffectedCategories({ categories, onSelect }) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? categories : categories.slice(0, PREVIEW_COUNT)
  const hidden = categories.length - PREVIEW_COUNT

  return (
    <div className="min-w-0 h-full flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">Categorías más afectadas</h3>
        {categories.length > 0 && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-on-surface-variant" aria-hidden="true">
            {LEGEND.map((item) => (
              <li key={item.key} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-sm ${item.fill}`} />
                {item.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      {categories.length === 0 ? (
        <p className="text-base text-on-surface-variant">En ninguna categoría hay personas inhabilitadas ni con documentos por vencer.</p>
      ) : (
        <>
          <ol className="flex flex-col gap-2" aria-label="Personas inhabilitadas y por vencer, por categoría">
            {visible.map((category) => <CategoryBar key={category.categoria_id} category={category} onSelect={onSelect} />)}
          </ol>
          {hidden > 0 && (
            <button type="button" onClick={() => setShowAll((current) => !current)} className={`${TEXT_BUTTON_CLASS} self-start text-base`} aria-expanded={showAll}>
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{showAll ? 'expand_less' : 'expand_more'}</span>
              {showAll ? 'Ver menos' : `Ver las ${formatCount(categories.length)} categorías`}
            </button>
          )}
        </>
      )}
    </div>
  )
}
