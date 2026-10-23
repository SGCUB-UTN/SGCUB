import { useEffect, useState } from 'react'
import { getAutorizantes } from '../../api/usuarios'
import { claseInput } from '../socios/socioForm'
import { SelectConFlecha } from '../socios/SocioFormFields'

// Building blocks shared by the finance modals (payment and benefit forms) so they look the same

// Hides the browser's increment arrows on number inputs for money and percentages
export const NO_SPINNER_CLASS = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

export const SUMMARY_GROUP_CLASS = 'mb-1 text-sm font-semibold uppercase tracking-wider text-outline'

export function SummaryLine({ label, value, isTotal = false, valueClassName = '' }) {
  const valueTone = valueClassName || 'text-on-surface'
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={isTotal ? 'text-base font-bold text-on-surface' : 'text-base text-on-surface-variant'}>{label}</span>
      <span className={`${isTotal ? 'text-lg font-bold' : 'text-base font-semibold'} ${valueTone}`}>{value}</span>
    </div>
  )
}

export function AuthorizerSelect({ id, value, onChange, invalid = false }) {
  const [authorizers, setAuthorizers] = useState(null)

  useEffect(() => {
    let active = true
    getAutorizantes()
      .then((users) => active && setAuthorizers(users))
      .catch(() => active && setAuthorizers([]))
    return () => { active = false }
  }, [])

  const placeholder = authorizers === null
    ? 'Cargando...'
    : authorizers.length ? 'Seleccioná quién autoriza' : 'No se pudieron cargar los usuarios'

  return (
    <SelectConFlecha
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={!authorizers?.length}
      conError={invalid}
    >
      <option value="">{placeholder}</option>
      {(authorizers ?? []).map((user) => <option key={user.id} value={user.full_name}>{user.full_name}</option>)}
    </SelectConFlecha>
  )
}

const AMOUNT_MODES = [
  { value: 'fijo', label: 'Monto fijo ($)' },
  { value: 'porcentaje', label: 'Porcentaje (%)' },
]

export function AmountModeInput({ mode, value, onModeChange, onValueChange, invalid = false }) {
  const isPercentage = mode === 'porcentaje'
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
      <div className="inline-flex self-start shrink-0 h-11 p-1 rounded bg-surface-container-low/60 border border-outline-variant/50" role="group" aria-label="Tipo de monto">
        {AMOUNT_MODES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onModeChange(option.value)}
            aria-pressed={mode === option.value}
            className={`px-3 rounded text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${mode === option.value ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="relative w-full min-w-0 sm:flex-1 sm:max-w-44">
        {!isPercentage && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base text-outline" aria-hidden="true">$</span>}
        <input
          type="number"
          inputMode="decimal"
          min={isPercentage ? '1' : '0.01'}
          max={isPercentage ? '100' : undefined}
          step={isPercentage ? '1' : '0.01'}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={isPercentage ? '0' : '0.00'}
          aria-label={isPercentage ? 'Porcentaje del beneficio' : 'Monto del beneficio'}
          aria-invalid={invalid || undefined}
          className={claseInput(invalid, `${NO_SPINNER_CLASS} font-semibold text-right ${isPercentage ? 'pr-8' : 'pl-7'}`)}
        />
        {isPercentage && <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-base text-outline" aria-hidden="true">%</span>}
      </div>
    </div>
  )
}

export function FormSection({ icon, title, description, disabled = false, className = '', children }) {
  return (
    <fieldset disabled={disabled} className={`min-w-0 flex flex-col gap-3 transition-opacity ${disabled ? 'opacity-50' : ''} ${className}`}>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-base" aria-hidden="true">{icon}</span>
          <h3 className="text-base font-bold uppercase tracking-wider text-on-surface">{title}</h3>
        </div>
        {description && <p className="text-base text-on-surface-variant">{description}</p>}
      </div>
      {children}
    </fieldset>
  )
}

export const TICKET_CLASS = 'h-full flex flex-col gap-4 p-5 rounded-lg border border-slate-200 bg-slate-50'

export const SUBMIT_BUTTON_CLASS = 'px-6 py-2.5 rounded text-sm font-semibold bg-primary hover:bg-primary/90 text-surface-container-lowest shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed'

export function TicketSection({ title, children }) {
  return (
    <div className="flex flex-1 flex-col gap-1.5 pb-3 border-b border-dashed border-slate-300">
      <h4 className={SUMMARY_GROUP_CLASS}>{title}</h4>
      <div className="flex flex-1 flex-col justify-evenly gap-1.5">{children}</div>
    </div>
  )
}
