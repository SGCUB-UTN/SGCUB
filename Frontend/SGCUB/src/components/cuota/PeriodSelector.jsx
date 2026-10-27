import FilterSelect from '../shared/FilterSelect'
import { formatPeriod } from '../shared/periodFormat'
import { shiftPeriod } from './cuotaPeriod'

const SELECT_CLASS = 'bg-surface-container-lowest border border-outline-variant/50 rounded text-on-surface text-sm font-semibold focus:outline-none focus:border-primary cursor-pointer'
const ARROW_CLASS = 'w-10 h-10 shrink-0 flex items-center justify-center rounded border border-outline-variant/50 text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60'

function ArrowButton({ icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick} className={ARROW_CLASS} aria-label={label} title={label}>
      <span className="material-symbols-outlined" style={{ fontSize: 20 }} aria-hidden="true">{icon}</span>
    </button>
  )
}

export default function PeriodSelector({ value, options = [], onChange }) {
  const periods = options.includes(value) ? options : [...options, value].sort().reverse()
  return (
    <div className="flex items-center gap-1.5">
      <FilterSelect
        etiqueta="Período:"
        className={SELECT_CLASS}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {periods.map((period) => <option key={period} value={period}>{formatPeriod(period)}</option>)}
      </FilterSelect>
      <ArrowButton icon="chevron_left" label="Período anterior" onClick={() => onChange(shiftPeriod(value, -1))} />
      <ArrowButton icon="chevron_right" label="Período siguiente" onClick={() => onChange(shiftPeriod(value, 1))} />
    </div>
  )
}
