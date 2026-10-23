import { useMemo, useState } from 'react'
import { postBecaSocio } from '../../api/becas'
import { postBeneficio } from '../../api/cuotas'
import { formatAmount, formatDate, getErrorMessage } from '../personas/format'
import { formatPeriod } from '../shared/periodFormat'
import { claseInput } from '../socios/socioForm'
import { Campo, SelectConFlecha } from '../socios/SocioFormFields'
import { AmountModeInput, AuthorizerSelect, FormSection, SUBMIT_BUTTON_CLASS, SummaryLine, TICKET_CLASS, TicketSection } from './formParts'
import { PERCENTAGE, benefitFor, benefitPayload, benefitValueError, discountBase, isOpen, previousBenefits, remainingWithoutFees, roundCents, todayIso } from './benefitMath'
import { isOverdue } from './cuotaStates'

const SCHOLARSHIP = 'beca'

const DISCOUNT = 'descuento'

const KINDS = [
  { value: SCHOLARSHIP, label: 'Beca', description: 'Se aplica a todas las cuotas dentro de su vigencia.'},
  { value: DISCOUNT, label: 'Descuento puntual', description: 'Ajuste sobre una sola cuota.' },
]

const REASON_MAX_LENGTH = 140

function KindOption({ kind, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(kind.value)}
      aria-pressed={selected}
      className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors cursor-pointer ${selected ? 'border-primary bg-primary/5' : 'border-outline-variant/50 bg-surface-container-lowest hover:bg-surface-container-low'}`}
    >
      <span className={`material-symbols-outlined text-[22px] ${selected ? 'text-primary' : 'text-outline'}`} aria-hidden="true">{kind.icon}</span>
      <span className="flex flex-col min-w-0">
        <span className="text-base font-semibold text-on-surface">{kind.label}</span>
        <span className="text-sm text-on-surface-variant">{kind.description}</span>
      </span>
    </button>
  )
}

// Without `socio`, renders the empty layout so the modal keeps its shape while the account loads
function BenefitForm({ socio = null, cuenta = null, onSuccess }) {
  const openCuotas = useMemo(
    () => (cuenta?.cuotas ?? []).filter(isOpen).sort((a, b) => String(a.periodo).localeCompare(String(b.periodo))),
    [cuenta],
  )
  const [kind, setKind] = useState(SCHOLARSHIP)
  const [cuotaId, setCuotaId] = useState('')
  const [startDate, setStartDate] = useState(todayIso)
  const [endDate, setEndDate] = useState('')
  const [mode, setMode] = useState(PERCENTAGE)
  const [value, setValue] = useState('')
  const [authorizer, setAuthorizer] = useState('')
  const [reason, setReason] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const isScholarship = kind === SCHOLARSHIP
  const cuota = openCuotas.find((item) => String(item.cuota_id) === cuotaId) ?? null
  const numericValue = Number(value)
  const hasValue = Number.isFinite(numericValue) && numericValue > 0

  const startPeriod = startDate.slice(0, 7)
  const endPeriod = endDate.slice(0, 7)
  const reachedCuotas = isScholarship && startDate && hasValue
    ? openCuotas
      .filter((item) => item.periodo >= startPeriod && (!endPeriod || item.periodo <= endPeriod))
      .map((item) => ({ cuota: item, amount: benefitFor(item, mode, numericValue) }))
      .filter((item) => item.amount > 0)
    : []
  const scholarshipTotal = roundCents(reachedCuotas.reduce((total, item) => total + item.amount, 0))

  const discountAmount = cuota && hasValue ? benefitFor(cuota, mode, numericValue) : 0
  const remaining = remainingWithoutFees(cuota)
  const pending = roundCents(Number(cuota?.saldo_pendiente ?? 0))

  const errors = {
    startDate: isScholarship && !startDate ? 'Indicá desde cuándo rige la beca.' : '',
    endDate: isScholarship && endDate && endDate < startDate ? 'No puede ser anterior a la fecha de inicio.' : '',
    cuota: !isScholarship && !cuota ? 'Elegí la cuota a descontar.' : '',
    value: benefitValueError(mode, numericValue, !isScholarship && cuota ? remaining : null),
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
    const common = benefitPayload(mode, numericValue, reason, authorizer)
    try {
      if (isScholarship) {
        await postBecaSocio(socio.socio_id, { ...common, fecha_aplicacion: startDate, fecha_fin: endDate || null })
      } else {
        await postBeneficio(cuota.cuota_id, { ...common, tipo: 'Descuento', fecha_aplicacion: todayIso() })
      }
      onSuccess?.()
    } catch (error) {
      setSubmitError(getErrorMessage(error, isScholarship ? 'No se pudo otorgar la beca.' : 'No se pudo aplicar el descuento.'))
    } finally {
      setSaving(false)
    }
  }

  const valueLabel = hasValue ? (mode === PERCENTAGE ? `${numericValue}%` : formatAmount(numericValue)) : '—'
  const submitLabel = () => {
    if (saving) return isScholarship ? 'Otorgando...' : 'Aplicando...'
    return isScholarship ? 'Otorgar beca' : 'Aplicar descuento'
  }

  return (
    <form onSubmit={submit} className="flex flex-col" noValidate>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-stretch">
        <div className="flex flex-col gap-5 min-w-0">
          <FormSection icon="category" title="Tipo de beneficio" disabled={!socio}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {KINDS.map((option) => (
                <KindOption key={option.value} kind={option} selected={kind === option.value} onSelect={setKind} />
              ))}
            </div>
          </FormSection>

          {isScholarship ? (
            <FormSection icon="event" title="Vigencia" disabled={!socio}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <Campo id="benefit-start" label="Desde" requerido error={fieldError('startDate')}>
                  <input
                    id="benefit-start"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className={claseInput(Boolean(fieldError('startDate')))}
                  />
                </Campo>
                <Campo id="benefit-end" label="Hasta" error={fieldError('endDate')}>
                  <input
                    id="benefit-end"
                    type="date"
                    min={startDate}
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    title="Si se deja vacío, la beca no tiene fecha de fin"
                    className={claseInput(Boolean(fieldError('endDate')))}
                  />
                </Campo>
              </div>
            </FormSection>
          ) : (
            <FormSection icon="receipt_long" title="Cuota" disabled={!socio}>
              <Campo id="benefit-cuota" label="Cuota a descontar" requerido error={fieldError('cuota')}>
                <SelectConFlecha
                  id="benefit-cuota"
                  value={cuotaId}
                  onChange={(event) => setCuotaId(event.target.value)}
                  conError={Boolean(fieldError('cuota'))}
                >
                  <option value="">{openCuotas.length ? 'Seleccioná una cuota' : 'El socio no tiene cuotas impagas'}</option>
                  {openCuotas.map((item) => (
                    <option key={item.cuota_id} value={String(item.cuota_id)}>
                      {formatPeriod(item.periodo)} · {formatAmount(remainingWithoutFees(item))}{isOverdue(item) ? ' · Vencida' : ''}
                    </option>
                  ))}
                </SelectConFlecha>
              </Campo>
            </FormSection>
          )}

          <FormSection icon="payments" title="Monto" disabled={!socio}>
            <AmountModeInput
              mode={mode}
              value={value}
              onModeChange={changeMode}
              onValueChange={setValue}
              invalid={Boolean(fieldError('value'))}
            />
            {fieldError('value') && <p className="text-sm text-error font-medium" role="alert">{errors.value}</p>}
          </FormSection>

          <FormSection icon="verified_user" title="Autorización" disabled={!socio} className="mt-auto">
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

        <div className={TICKET_CLASS} role="region" aria-labelledby="benefit-summary-title">
          <h3 id="benefit-summary-title" className="text-lg font-bold text-on-surface">Resumen del beneficio</h3>

          <div className="flex flex-1 flex-col justify-between gap-3">
            <TicketSection title={isScholarship ? 'Beca institucional' : 'Descuento puntual'}>
              <SummaryLine label="Valor" value={valueLabel} />
              {isScholarship ? (
                <>
                  <SummaryLine label="Desde" value={startDate ? formatDate(startDate) : '—'} />
                  <SummaryLine label="Hasta" value={endDate ? formatDate(endDate) : 'Sin fecha de fin'} />
                </>
              ) : (
                <SummaryLine label="Cuota" value={cuota ? formatPeriod(cuota.periodo) : '—'} />
              )}
              <SummaryLine label="Autoriza" value={authorizer || '—'} />
            </TicketSection>

            {isScholarship ? (
              <>
                <TicketSection title="Cuotas impagas alcanzadas">
                  {reachedCuotas.length
                    ? reachedCuotas.map((item) => (
                      <SummaryLine
                        key={item.cuota.cuota_id}
                        label={`Cuota ${formatPeriod(item.cuota.periodo)}`}
                        value={`− ${formatAmount(item.amount)}`}
                        valueClassName="text-emerald-700"
                      />
                    ))
                    : <p className="text-base text-on-surface-variant">Ninguna por ahora.</p>}
                </TicketSection>
                <div className="flex flex-col gap-1">
                  <SummaryLine label="Descuento total" value={formatAmount(scholarshipTotal)} isTotal valueClassName="text-emerald-700" />
                  <p className="text-sm text-on-surface-variant">También se aplica a las cuotas que se generen dentro de la vigencia.</p>
                </div>
              </>
            ) : (
              <>
                <TicketSection title={cuota ? `Cuota ${formatPeriod(cuota.periodo)}` : 'Cuota'}>
                  <SummaryLine label="Total sin recargo" value={formatAmount(discountBase(cuota))} />
                  {previousBenefits(cuota) > 0 && <SummaryLine label="Beneficios anteriores" value={`− ${formatAmount(previousBenefits(cuota))}`} />}
                  <SummaryLine label="Descuento" value={`− ${formatAmount(discountAmount)}`} valueClassName="text-emerald-700" />
                  {pending - remaining > 0 && <SummaryLine label="Recargo por mora pendiente" value={`+ ${formatAmount(roundCents(pending - remaining))}`} />}
                </TicketSection>
                <SummaryLine label="Nuevo saldo" value={formatAmount(roundCents(pending - discountAmount))} isTotal />
              </>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {submitError && (
              <div className="bg-error-container text-on-error-container p-3 rounded-lg border border-error/30 flex items-start gap-2.5" role="alert">
                <span className="material-symbols-outlined text-base text-error shrink-0" aria-hidden="true">error</span>
                <p className="text-sm break-words">{submitError}</p>
              </div>
            )}
            <button type="submit" disabled={!socio || saving} className={`${SUBMIT_BUTTON_CLASS} w-full h-11 justify-center text-base`}>
              <span className={`material-symbols-outlined text-base ${saving ? 'animate-spin' : ''}`} aria-hidden="true">
                {saving ? 'progress_activity' : isScholarship ? 'school' : 'sell'}
              </span>
              <span>{submitLabel()}</span>
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}

export default BenefitForm
