import { useRef } from 'react'
import { currentPeriod, formatPeriod } from '../shared/periodFormat'
import { isValidPeriod, shiftPeriod } from './cuotaPeriod'

const CONTROL_CLASS = 'h-10 shrink-0 flex items-center justify-center gap-1.5 rounded border border-outline-variant/50 text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60'

function ArrowButton({ icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`${CONTROL_CLASS} w-10`} aria-label={label} title={label}>
      <span className="material-symbols-outlined" style={{ fontSize: 20 }} aria-hidden="true">{icon}</span>
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
    <div className="flex items-center gap-1.5">
      <ArrowButton icon="chevron_left" label="Período anterior" onClick={() => onChange(shiftPeriod(value, -1))} />
      <div className="relative">
        <button
          type="button"
          onClick={() => openPicker(inputRef.current)}
          className={`${CONTROL_CLASS} min-w-44 px-3 text-sm font-semibold text-on-surface`}
          aria-label={`Período: ${formatPeriod(value)}. Elegir mes y año`}
        >
          <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 18 }} aria-hidden="true">calendar_month</span>
          {formatPeriod(value)}
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
      {value !== today && (
        <button type="button" onClick={() => onChange(today)} className={`${CONTROL_CLASS} px-3 text-sm font-semibold text-primary`}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">today</span>
          Mes actual
        </button>
      )}
    </div>
  )
}
