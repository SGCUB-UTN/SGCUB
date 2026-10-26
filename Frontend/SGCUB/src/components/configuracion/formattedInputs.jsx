import { NO_SPINNER_CLASS } from '../finanzas/formParts'
import { formatCuit, formatThousands } from './numberFormat'
import { compactInputClass } from './settingsForm'

const digitsOf = (text) => String(text ?? '').replace(/\D/g, '')

function AffixInput({ prefix, suffix, invalid, small = false, className = '', ...props }) {
  const padding = `${prefix ? 'pl-7' : ''} ${suffix ? (suffix.length > 1 ? 'pr-11' : 'pr-8') : ''}`
  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-outline" aria-hidden="true">{prefix}</span>}
      <input
        type="text"
        aria-invalid={invalid || undefined}
        className={compactInputClass(invalid, `${NO_SPINNER_CLASS} ${padding} ${className}`, small)}
        {...props}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-outline" aria-hidden="true">{suffix}</span>}
    </div>
  )
}

// Whole pesos with thousands separators ("20.000"); the value it reports is the plain number ("20000")
export function MoneyInput({ value, onChange, ...props }) {
  return (
    <AffixInput
      prefix="$"
      inputMode="numeric"
      placeholder="0"
      value={formatThousands(value)}
      onChange={(event) => onChange(digitsOf(event.target.value).replace(/^0+(?=\d)/, ''))}
      className="text-right font-semibold"
      {...props}
    />
  )
}

// Up to two decimals typed with a comma ("12,5"); the value it reports uses a dot ("12.5")
export function PercentInput({ value, onChange, ...props }) {
  const shown = String(value ?? '').replace('.', ',')
  const handleChange = (event) => {
    const text = event.target.value.replace('.', ',')
    if (!/^\d{0,3}(,\d{0,2})?$/.test(text)) return
    onChange(text.replace(',', '.'))
  }
  return (
    <AffixInput
      suffix="%"
      inputMode="decimal"
      placeholder="0"
      value={shown.endsWith(',00') ? shown.slice(0, -3) : shown}
      onChange={handleChange}
      className="text-right font-semibold"
      {...props}
    />
  )
}

// Whole numbers, with a unit after the value ("días", "cuotas", "meses")
export function IntegerInput({ value, onChange, unit, maxLength = 3, ...props }) {
  return (
    <AffixInput
      suffix={unit}
      inputMode="numeric"
      value={value ?? ''}
      maxLength={maxLength}
      onChange={(event) => onChange(digitsOf(event.target.value))}
      {...props}
    />
  )
}

// "30-12345678-9" while typing; the backend stores it with the same format
export function CuitInput({ value, onChange, ...props }) {
  return (
    <AffixInput
      inputMode="numeric"
      placeholder="30-12345678-9"
      value={formatCuit(value)}
      onChange={(event) => onChange(formatCuit(event.target.value))}
      {...props}
    />
  )
}
