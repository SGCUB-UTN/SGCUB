import { useState } from 'react'
import { SelectConFlecha } from '../socios/SocioFormFields'

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const splitPeriod = (period) => {
  const [year = '', month = ''] = String(period ?? '').split('-')
  return { year, month }
}

const yearOptions = (selected, past, future) => {
  const current = new Date().getFullYear()
  const years = new Set(Array.from({ length: past + future + 1 }, (_, index) => String(current - past + index)))
  if (selected) years.add(selected)
  return [...years].sort()
}

export default function PeriodField({ id, value, onChange, disabled = false, invalid = false, pastYears = 1, futureYears = 3 }) {
  const [draft, setDraft] = useState(() => splitPeriod(value))
  const shown = value ? splitPeriod(value) : draft

  const change = (part, next) => {
    const updated = { ...shown, [part]: next }
    setDraft(updated)
    onChange(updated.year && updated.month ? `${updated.year}-${updated.month}` : '')
  }

  return (
    <div id={id} className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-2" role="group">
      <SelectConFlecha
        aria-label="Mes"
        value={shown.month}
        onChange={(event) => change('month', event.target.value)}
        disabled={disabled}
        conError={invalid && !shown.month}
      >
        <option value="">Mes</option>
        {MONTHS.map((name, index) => {
          const month = String(index + 1).padStart(2, '0')
          return <option key={month} value={month}>{name}</option>
        })}
      </SelectConFlecha>
      <SelectConFlecha
        aria-label="Año"
        value={shown.year}
        onChange={(event) => change('year', event.target.value)}
        disabled={disabled}
        conError={invalid && !shown.year}
      >
        <option value="">Año</option>
        {yearOptions(shown.year, pastYears, futureYears).map((year) => <option key={year} value={year}>{year}</option>)}
      </SelectConFlecha>
    </div>
  )
}
