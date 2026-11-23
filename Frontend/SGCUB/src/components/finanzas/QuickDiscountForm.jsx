import { useState } from 'react'
import { postBeneficio } from '../../api/cuotas'
import { formatAmount, getErrorMessage } from '../personas/format'
import { claseInput } from '../socios/socioForm'
import { Campo } from '../socios/SocioFormFields'
import { AmountModeInput, AuthorizerSelect, BenefitValueError, SUBMIT_BUTTON_CLASS, SummaryLine } from './formParts'
import { PERCENTAGE, benefitPayload, benefitValueError, discountFor, exceedsMax, remainingToPay, roundCents, todayIso } from './benefitMath'

const REASON_MAX_LENGTH = 140

function QuickDiscountForm({ cuota, onSuccess }) {
  const [mode, setMode] = useState(PERCENTAGE)
  const [value, setValue] = useState('')
  const [authorizer, setAuthorizer] = useState('')
  const [reason, setReason] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const numericValue = Number(value)
  const pending = remainingToPay(cuota)
  const discount = numericValue > 0 ? discountFor(cuota, mode, numericValue) : 0

  const errors = {
    value: benefitValueError(mode, numericValue, { maxFixed: pending }),
    authorizer: !authorizer ? 'Elegí quién autoriza.' : '',
    reason: !reason.trim() ? 'Indicá el motivo.' : '',
  }
  const fieldError = (key) => (showErrors ? errors[key] : '')

  const changeMode = (nextMode) => {
    setMode(nextMode)
    setValue('')
  }

  const submit = async (event) => {
    event.preventDefault()
    event.stopPropagation()
    setShowErrors(true)
    if (Object.values(errors).some(Boolean)) return
    setSaving(true)
    setSubmitError('')
    try {
      await postBeneficio(cuota.cuota_id, {
        ...benefitPayload(mode, numericValue, reason, authorizer),
        tipo: 'Descuento',
        fecha_aplicacion: todayIso(),
      })
      onSuccess?.()
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'No se pudo aplicar el descuento.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <AmountModeInput mode={mode} value={value} onModeChange={changeMode} onValueChange={setValue} invalid={Boolean(fieldError('value'))} />
        <BenefitValueError
          message={fieldError('value')}
          maxFixed={pending}
          canUseMax={exceedsMax(mode, numericValue, pending)}
          onUseMax={setValue}
        />
        {mode === PERCENTAGE && !fieldError('value') && (
          <p className="text-sm text-on-surface-variant">El porcentaje se calcula sobre lo que le resta pagar a la cuota ({formatAmount(pending)}).</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-slate-200 bg-slate-50">
        <SummaryLine label="Resta pagar" value={formatAmount(pending)} />
        <SummaryLine label="Descuento" value={`− ${formatAmount(discount)}`} valueClassName="text-emerald-700" />
        <div className="pt-1.5 mt-0.5 border-t border-dashed border-slate-300">
          <SummaryLine label="Nuevo total" value={formatAmount(roundCents(pending - discount))} isTotal />
        </div>
      </div>

      <Campo id="quick-discount-reason" label="Motivo" requerido error={fieldError('reason')}>
        <input
          id="quick-discount-reason"
          type="text"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={REASON_MAX_LENGTH}
          placeholder="Ej: Hermanos en el club"
          className={claseInput(Boolean(fieldError('reason')))}
        />
      </Campo>

      <Campo id="quick-discount-authorizer" label="Autorizado por" requerido error={fieldError('authorizer')}>
        <AuthorizerSelect id="quick-discount-authorizer" value={authorizer} onChange={setAuthorizer} invalid={Boolean(fieldError('authorizer'))} />
      </Campo>

      {submitError && (
        <div className="bg-error-container text-on-error-container p-3 rounded-lg border border-error/30 flex items-start gap-2.5" role="alert">
          <span className="material-symbols-outlined text-base text-error shrink-0" aria-hidden="true">error</span>
          <p className="text-sm break-words">{submitError}</p>
        </div>
      )}

      <div className="flex justify-end pt-1">
        <button type="submit" disabled={saving} className={`${SUBMIT_BUTTON_CLASS} h-11 justify-center text-base`}>
          <span>{saving ? 'Aplicando...' : 'Aceptar'}</span>
        </button>
      </div>
    </form>
  )
}

export default QuickDiscountForm
