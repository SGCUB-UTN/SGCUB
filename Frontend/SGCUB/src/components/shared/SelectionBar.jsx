import { formatCount } from '../cuota/cuotaPeriod'
import { TEXT_BUTTON_CLASS } from './textButton'

export default function SelectionBar({ count, singular, plural, detail, onClear, children }) {
  return (
    <div
      role="region"
      aria-label="Acciones sobre la selección"
      className="flex flex-col sm:flex-row sm:items-center gap-3 mx-4 sm:mx-5 my-3 px-4 py-3 rounded-lg bg-primary/5 border border-primary/20"
    >
      <p className="flex flex-wrap items-baseline gap-x-2 text-base text-on-surface" aria-live="polite">
        <span className="inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">check_box</span>
          <span>
            <strong className="font-semibold tabular-nums">{formatCount(count)}</strong> {count === 1 ? singular : plural}
          </span>
        </span>
        {detail && <span className="text-on-surface-variant">· {detail}</span>}
      </p>
      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        {children}
        <button type="button" onClick={onClear} className={`${TEXT_BUTTON_CLASS} h-10 text-base`}>
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
          Quitar selección
        </button>
      </div>
    </div>
  )
}
