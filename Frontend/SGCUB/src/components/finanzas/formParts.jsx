import { useEffect, useId, useState } from 'react'
import { getAutorizantes } from '../../api/usuarios'
import { SelectConFlecha } from '../socios/SocioFormFields'

// Building blocks shared by the finance modals (payment and benefit forms) so they look the same

export const FIELD_CLASS = 'w-full h-10 bg-surface-container-low rounded-lg border text-base text-on-surface focus:outline-none focus:border-primary'

// Hides the browser's increment arrows on number inputs for money and percentages
export const NO_SPINNER_CLASS = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

export const SUMMARY_GROUP_CLASS = 'mb-1 text-sm font-semibold uppercase tracking-wider text-outline'

export function StepSection({ step, title, description, disabled = false, children }) {
  const titleId = useId()
  return (
    <fieldset disabled={disabled} aria-labelledby={titleId} className={`min-w-0 flex flex-col gap-3 transition-opacity ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-3">
          <span className={`w-7 h-7 rounded-full text-sm font-bold flex items-center justify-center shrink-0 ${disabled ? 'bg-surface-container-high text-on-surface-variant' : 'bg-primary text-on-primary'}`} aria-hidden="true">
            {step}
          </span>
          <h3 id={titleId} className="text-lg font-bold text-on-surface">{title}</h3>
        </div>
        <p className="text-sm text-on-surface-variant pl-10">{description}</p>
      </div>
      {children}
    </fieldset>
  )
}

export function SummaryLine({ label, value, isTotal = false, valueClassName = '' }) {
  const valueTone = valueClassName || 'text-on-surface'
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={isTotal ? 'text-base font-bold text-on-surface' : 'text-base text-on-surface-variant'}>{label}</span>
      <span className={`${isTotal ? 'text-lg font-bold' : 'text-base font-semibold'} ${valueTone}`}>{value}</span>
    </div>
  )
}

export function FieldLabel({ htmlFor, children, optional = false }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-semibold text-on-surface-variant">
      {children}
      {optional ? <span className="font-normal text-outline"> (opcional)</span> : <span className="text-error"> *</span>}
    </label>
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

export function FormFooter({ children }) {
  return (
    <div className="pt-6 border-t border-outline-variant/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="text-base text-on-surface-variant flex items-center gap-1.5">
        <span className="text-error font-bold">*</span> Campos obligatorios
      </div>
      <div className="flex items-center gap-3 self-end sm:self-auto">{children}</div>
    </div>
  )
}

export function TicketSection({ title, children }) {
  return (
    <section className="flex flex-1 flex-col gap-1.5 pb-3 border-b border-dashed border-slate-300">
      <h4 className={SUMMARY_GROUP_CLASS}>{title}</h4>
      <div className="flex flex-1 flex-col justify-evenly gap-1.5">{children}</div>
    </section>
  )
}
