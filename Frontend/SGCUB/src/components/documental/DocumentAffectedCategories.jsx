import useEntered from '../../hooks/useEntered'
import { formatCount } from '../cuota/cuotaPeriod'
import { ROW_HOVER, WIDTH_MOTION, grown } from '../shared/chartMotion'
import { shareOf } from '../finanzas/cashFormat'

const LIST_HEIGHT_CLASS = 'max-h-[10.75rem]'

const SEGMENTS = [
  { key: 'vencidos', label: 'Vencidos', short: 'venc.', fill: 'bg-error', text: 'text-error' },
  { key: 'faltantes', label: 'Faltantes', short: 'falt.', fill: 'bg-outline', text: 'text-on-surface' },
]

const detail = (category) => SEGMENTS
  .filter((segment) => category[segment.key] > 0)
  .map((segment) => `${formatCount(category[segment.key])} ${segment.label.toLowerCase()}`)
  .join(' y ')

function CategoryBar({ category, onSelect }) {
  const entered = useEntered()
  const segments = SEGMENTS.filter((segment) => category[segment.key] > 0)
  return (
    <li className="flex shrink-0">
      <button
        type="button"
        onClick={() => onSelect(category.categoria_id)}
        title={`${category.categoria}: ${detail(category)} de ${formatCount(category.total)} documentos. Ver en la tabla.`}
        className={`flex-1 min-w-0 flex flex-col gap-1 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${ROW_HOVER}`}
      >
        <span className="flex items-baseline justify-between gap-3 text-sm">
          <span className="min-w-0 truncate font-semibold text-on-surface">{category.categoria}</span>
          <span className="shrink-0 text-on-surface-variant">
            {segments.map((segment, index) => (
              <span key={segment.key}>
                {index > 0 && ' · '}
                <span className={`font-semibold tabular-nums ${segment.text}`}>{formatCount(category[segment.key])}</span>
                {` ${segment.short}`}
              </span>
            ))}
            {` de ${formatCount(category.total)}`}
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

function Legend({ showMissing }) {
  const items = [
    SEGMENTS[0],
    ...(showMissing ? [SEGMENTS[1]] : []),
    { key: 'resto', label: 'Al día', fill: 'bg-emerald-600' },
  ]
  return (
    <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-on-surface-variant" aria-hidden="true">
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-sm ${item.fill}`} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

export default function DocumentAffectedCategories({ categories, onSelect }) {
  const showMissing = categories.some((category) => category.faltantes > 0)
  return (
    <div className="min-w-0 h-full flex flex-col">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">Categorías más afectadas</h3>
      {categories.length === 0 ? (
        <p className="mt-2 text-sm text-on-surface-variant">Ninguna categoría tiene documentos vencidos ni faltantes.</p>
      ) : (
        <>
          <Legend showMissing={showMissing} />
          <ol className={`mt-1 -mx-2 pl-2 pr-3 flex flex-col gap-1 overflow-y-auto thin-scroll ${LIST_HEIGHT_CLASS}`} aria-label="Documentos vencidos y faltantes por categoría">
            {categories.map((category) => <CategoryBar key={category.categoria_id} category={category} onSelect={onSelect} />)}
          </ol>
        </>
      )}
    </div>
  )
}
