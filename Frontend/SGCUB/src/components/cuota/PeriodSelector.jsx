import { useRef } from 'react'
import { currentPeriod, formatPeriod, formatShortPeriod } from '../shared/periodFormat'
import { isValidPeriod, shiftPeriod } from './cuotaPeriod'

const CONTROL_CLASS = 'h-full shrink-0 flex items-center justify-center gap-1.5 text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60'
const TODAY_CLASS = 'h-8 shrink-0 inline-flex items-center gap-1 px-1 rounded text-sm font-semibold text-primary hover:text-primary/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60'
const GROUP_CLASS = 'flex items-center h-8 rounded-full border border-outline-variant/60 bg-surface-container-low shadow-sm overflow-hidden divide-x divide-outline-variant/40'

function ArrowButton({ icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`${CONTROL_CLASS} w-8`} aria-label={label} title={label}>
      <span className="material-symbols-outlined" style={{ fontSize: 16 }} aria-hidden="true">{icon}</span>
    </button>
  )
}

function openPicker(input) {
  try {
    input.showPicker()
  } catch {
    input.focus()
  }
}

export default function PeriodSelector({ value, onChange }) {
  const inputRef = useRef(null)
  const today = currentPeriod()

  return (
    <div className="flex items-center gap-2">
      {value !== today && (
        <button type="button" onClick={() => onChange(today)} className={TODAY_CLASS}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">undo</span>
          Hoy
        </button>
      )}
      <div className={GROUP_CLASS}>
        <ArrowButton icon="chevron_left" label="Período anterior" onClick={() => onChange(shiftPeriod(value, -1))} />
        <div className="relative h-full">
          <button
            type="button"
            onClick={() => openPicker(inputRef.current)}
            className={`${CONTROL_CLASS} w-40 px-3 text-sm font-semibold text-on-surface`}
            aria-label={`Período: ${formatPeriod(value)}. Elegir mes y año`}
          >
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }} aria-hidden="true">calendar_month</span>
            {formatShortPeriod(value)}
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 18 }} aria-hidden="true">expand_more</span>
          </button>
          <input
            ref={inputRef}
            type="month"
            tabIndex={-1}
            aria-hidden="true"
            className="absolute inset-0 opacity-0 pointer-events-none"
            value={value}
            onChange={(event) => isValidPeriod(event.target.value) && onChange(event.target.value)}
          />
        </div>
        <ArrowButton icon="chevron_right" label="Período siguiente" onClick={() => onChange(shiftPeriod(value, 1))} />
      </div>
    </div>
  )
}
