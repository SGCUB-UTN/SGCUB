import { useState } from 'react'
import { postBecaSocio } from '../../api/becas'
import { formatAmount, getErrorMessage } from '../personas/format'
import { currentPeriod, formatPeriod, periodEndDate, periodStartDate } from '../shared/periodFormat'
import PeriodField from '../shared/PeriodField'
import { claseInput } from '../socios/socioForm'
import { Campo } from '../socios/SocioFormFields'
import { AmountModeInput, AuthorizerSelect, BenefitValueError, FormSection, SUBMIT_BUTTON_CLASS, SummaryLine, TICKET_CLASS, TicketSection } from './formParts'
import { PERCENTAGE, benefitPayload, benefitValueError } from './benefitMath'

const REASON_MAX_LENGTH = 140


// Without `socio`, renders the empty layout so the modal keeps its shape while the account loads
function ScholarshipForm({ socio = null, onSuccess }) {
  const [startPeriod, setStartPeriod] = useState(currentPeriod)
  const [endPeriod, setEndPeriod] = useState('')
  const [noEndDate, setNoEndDate] = useState(false)
  const [mode, setMode] = useState(PERCENTAGE)
  const [value, setValue] = useState('')
  const [authorizer, setAuthorizer] = useState('')
  const [reason, setReason] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const numericValue = Number(value)
  const hasValue = Number.isFinite(numericValue) && numericValue > 0


  const errors = {
    startPeriod: !startPeriod ? 'Elegí el mes y el año desde el que rige la beca.' : '',
    endPeriod: (() => {
      if (noEndDate) return ''
      if (!endPeriod) return 'Elegí el mes y el año hasta el que rige, o marcá "Sin fecha de finalización".'
      return endPeriod < startPeriod ? 'No puede ser anterior al período de inicio.' : ''
    })(),
    value: benefitValueError(mode, numericValue),
    authorizer: !authorizer ? 'Elegí quién autoriza.' : '',
    reason: !reason.trim() ? 'Indicá el motivo.' : '',
  }
  const isValid = Object.values(errors).every((error) => !error)
  const fieldError = (key) => (showErrors ? errors[key] : '')

  const changeMode = (nextMode) => {
    setMode(nextMode)
    setValue('')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!socio) return
    setShowErrors(true)
    if (!isValid) return
    setSaving(true)
    setSubmitError('')
    try {
      await postBecaSocio(socio.socio_id, {
        ...benefitPayload(mode, numericValue, reason, authorizer),
        fecha_aplicacion: periodStartDate(startPeriod),
        fecha_fin: noEndDate ? null : periodEndDate(endPeriod),
      })
      onSuccess?.()
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'No se pudo otorgar la beca.'))
    } finally {
      setSaving(false)
    }
  }

  const valueLabel = hasValue ? (mode === PERCENTAGE ? `${numericValue}%` : formatAmount(numericValue)) : '—'

  return (
    <form onSubmit={submit} className="flex flex-col" noValidate>
      <div className={`grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-stretch ${socio ? '' : 'grayscale'}`}>
        <div className="flex flex-col gap-6 min-w-0">
          <FormSection icon="event" title="Vigencia" disabled={!socio}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <Campo id="benefit-start" label="Desde" requerido error={fieldError('startPeriod')}>
                  <PeriodField
                    id="benefit-start"
                    value={startPeriod}
                    onChange={setStartPeriod}
                    invalid={Boolean(fieldError('startPeriod'))}
                  />
                </Campo>
                <Campo id="benefit-end" label="Hasta" requerido={!noEndDate} error={fieldError('endPeriod')}>
                  <PeriodField
                    key={noEndDate ? 'sin-fin' : 'con-fin'}
                    id="benefit-end"
                    value={endPeriod}
                    onChange={setEndPeriod}
                    disabled={noEndDate}
                    invalid={Boolean(fieldError('endPeriod'))}
                  />
                  <label className="self-start flex items-center gap-2 text-base text-on-surface-variant cursor-pointer">
                    <input
                      type="checkbox"
                      checked={noEndDate}
                      onChange={(event) => {
                        setNoEndDate(event.target.checked)
                        if (event.target.checked) setEndPeriod('')
                      }}
                      className="size-5 accent-primary"
                    />
                    Sin fecha de finalización
                  </label>
                </Campo>
              </div>
            </FormSection>

          <FormSection icon="payments" title="Valor" disabled={!socio}>
            <AmountModeInput
              mode={mode}
              value={value}
              onModeChange={changeMode}
              onValueChange={setValue}
              invalid={Boolean(fieldError('value'))}
            />
            <BenefitValueError message={fieldError('value')} />
            {mode === PERCENTAGE && numericValue >= 100 && (
              <p className="text-sm text-on-surface-variant">Una beca del 100% salda todo lo que le resta a cada cuota, recargos incluidos.</p>
            )}
          </FormSection>

          <FormSection icon="verified_user" title="Autorización" disabled={!socio}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              <Campo id="benefit-authorizer" label="Autorizado por" requerido error={fieldError('authorizer')}>
                <AuthorizerSelect id="benefit-authorizer" value={authorizer} onChange={setAuthorizer} invalid={Boolean(fieldError('authorizer'))} />
              </Campo>
              <Campo id="benefit-reason" label="Motivo" requerido error={fieldError('reason')}>
                <input
                  id="benefit-reason"
                  type="text"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={REASON_MAX_LENGTH}
                  placeholder="Ej: Hermanos en el club"
                  className={claseInput(Boolean(fieldError('reason')))}
                />
              </Campo>
            </div>
          </FormSection>
        </div>

        <div className={`${TICKET_CLASS} transition-opacity ${socio ? '' : 'opacity-50'}`} role="region" aria-labelledby="benefit-summary-title" aria-disabled={!socio || undefined}>
          <h3 id="benefit-summary-title" className="text-lg font-bold text-on-surface">Resumen de la beca</h3>

          <div className="flex flex-col gap-4">
            <TicketSection title="Beca" spread={false}>
              <SummaryLine label="Valor" value={valueLabel} />
              <SummaryLine label="Desde" value={startPeriod ? formatPeriod(startPeriod) : '—'} />
              <SummaryLine label="Hasta" value={noEndDate ? 'Sin fecha de finalización' : endPeriod ? formatPeriod(endPeriod) : '—'} />
              <SummaryLine label="Autoriza" value={authorizer || '—'} />
            </TicketSection>
          </div>

          <div className="mt-auto flex flex-col gap-3">
            {submitError && (
              <div className="bg-error-container text-on-error-container p-3 rounded-lg border border-error/30 flex items-start gap-2.5" role="alert">
                <span className="material-symbols-outlined text-base text-error shrink-0" aria-hidden="true">error</span>
                <p className="text-sm break-words">{submitError}</p>
              </div>
            )}
            <button type="submit" disabled={!socio || saving} className={`${SUBMIT_BUTTON_CLASS} w-full h-11 justify-center text-base`}>
              <span>{saving ? 'Otorgando...' : 'Otorgar beca'}</span>
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}

export default ScholarshipForm
