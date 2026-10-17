import { useMemo, useState } from 'react'
import { postBeneficio } from '../../api/cuotas'
import { formatAmount, formatDate, getErrorMessage } from '../personas/format'
import { PrimaryButton, SecondaryButton } from '../personas/tabs/parts'
import { formatPeriod } from '../shared/periodFormat'
import { FIELD_CLASS, NO_SPINNER_CLASS, StepSection, SUMMARY_GROUP_CLASS, SummaryLine } from './formParts'
import { isPaid } from './accountStatement'
import { cuotaStateBadgeClass, cuotaStateLabel } from './cuotaStates'

const KINDS = [
  { value: 'descuento', label: 'Descuento', description: 'Se aplica una sola vez, sobre esta cuota.' },
  { value: 'beca', label: 'Beca', description: 'Se aplica a esta cuota y a las siguientes mientras esté vigente.' },
]

const MODES = [
  { value: 'fijo', label: 'Monto fijo' },
  { value: 'porcentaje', label: 'Porcentaje' },
]

const REASON_MAX_LENGTH = 140

const LATE_FEE_CONCEPT = 'Mora'

const todayIso = () => {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

const roundCents = (value) => Math.round((value + Number.EPSILON) * 100) / 100

const sumItems = (cuota, predicate) => roundCents((cuota?.items ?? [])
  .filter(predicate)
  .reduce((total, item) => total + Number(item.monto ?? 0), 0))

// The benefit is calculated over the whole cuota, late fees excluded
const discountBase = (cuota) => sumItems(cuota, (item) => !item.es_descuento && item.concepto !== LATE_FEE_CONCEPT)

const previousDiscounts = (cuota) => sumItems(cuota, (item) => item.es_descuento)

// What is left to pay without the late fees still unpaid: the most a benefit can take off the cuota
const remainingWithoutFees = (cuota) => roundCents(Number(cuota?.saldo_sin_recargo ?? 0))

const isOpen = (cuota) => !isPaid(cuota) && Number(cuota.saldo_pendiente ?? 0) > 0

function CuotaChoice({ cuota, selected, onSelect }) {
  return (
    <label className={`flex items-center gap-3 p-3 sm:p-4 rounded-lg border cursor-pointer transition-colors ${selected ? 'border-primary bg-primary/5' : 'border-outline-variant/40 bg-surface-container-lowest hover:bg-surface-container-low'}`}>
      <input
        type="radio"
        name="benefit-cuota"
        checked={selected}
        onChange={() => onSelect(cuota.cuota_id)}
        className="h-4 w-4 accent-primary shrink-0"
      />
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base font-semibold text-on-surface">Cuota {formatPeriod(cuota.periodo)}</span>
          <span className={`px-2 py-0.5 rounded text-xs font-bold border ${cuotaStateBadgeClass(cuota.estado_cuota)}`}>{cuotaStateLabel(cuota.estado_cuota)}</span>
        </div>
        <span className="text-sm text-on-surface-variant">
          {cuota.fecha_venc1 ? `Vence el ${formatDate(cuota.fecha_venc1)}` : 'Sin fecha de vencimiento'}
          {Number(cuota.monto_pagado ?? 0) > 0 && ` · Pagado ${formatAmount(Number(cuota.monto_pagado))}`}
        </span>
      </div>
      <div className="text-right shrink-0">
        <span className="block text-xs text-on-surface-variant">Falta pagar sin recargo</span>
        <span className="text-base font-bold text-on-surface">{formatAmount(remainingWithoutFees(cuota))}</span>
      </div>
    </label>
  )
}

function KindOption({ kind, selected, disabled, onSelect }) {
  return (
    <label className={`flex items-start gap-3 p-3 sm:p-4 rounded-lg border transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${selected ? 'border-primary bg-primary/5' : 'border-outline-variant/40 bg-surface-container-lowest'} ${!selected && !disabled ? 'hover:bg-surface-container-low' : ''}`}>
      <input
        type="radio"
        name="benefit-kind"
        checked={selected}
        disabled={disabled}
        onChange={() => onSelect(kind.value)}
        className="mt-1 h-4 w-4 accent-primary shrink-0"
      />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-base font-semibold text-on-surface">{kind.label}</span>
        <span className="text-sm text-on-surface-variant">{kind.description}</span>
      </div>
    </label>
  )
}

function FieldLabel({ htmlFor, children, optional = false }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-semibold text-on-surface-variant">
      {children}
      {optional ? <span className="font-normal text-outline"> (opcional)</span> : <span className="text-error"> *</span>}
    </label>
  )
}

// Without `socio`, renders the empty layout so the modal keeps its shape while the account loads.
// Without `initialCuotaId`, the first step asks which cuota the benefit is calculated on.
function BenefitForm({ socio = null, cuenta = null, initialCuotaId = null, onCancel, onSuccess }) {
  const openCuotas = useMemo(
    () => (cuenta?.cuotas ?? []).filter(isOpen).sort((a, b) => String(b.periodo).localeCompare(String(a.periodo))),
    [cuenta],
  )
  const askCuota = !initialCuotaId
  const [cuotaId, setCuotaId] = useState(initialCuotaId)
  const [kind, setKind] = useState(null)
  const [mode, setMode] = useState('fijo')
  const [value, setValue] = useState('')
  const [startDate, setStartDate] = useState(todayIso)
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const cuota = (cuenta?.cuotas ?? []).find((item) => item.cuota_id === cuotaId) ?? null
  const paid = Boolean(cuota) && !isOpen(cuota)
  const selectedKind = paid ? 'beca' : (kind ?? 'descuento')
  const isScholarship = selectedKind === 'beca'

  const base = discountBase(cuota)
  const discounts = previousDiscounts(cuota)
  const remaining = remainingWithoutFees(cuota)
  const pending = roundCents(Number(cuota?.saldo_pendiente ?? 0))
  const paidWithoutFees = Math.max(roundCents(base - discounts - remaining), 0)
  const unpaidFees = Math.max(roundCents(pending - remaining), 0)
  const numericValue = Number(value)
  const requestedAmount = Number.isFinite(numericValue) && numericValue > 0
    ? roundCents(mode === 'porcentaje' ? base * numericValue / 100 : numericValue)
    : 0
  const appliedAmount = paid ? 0 : Math.min(requestedAmount, remaining)
  const newPending = roundCents(pending - appliedAmount)
  const scholarshipCapped = isScholarship && !paid && requestedAmount > remaining

  const valueError = (() => {
    if (!isScholarship && remaining <= 0) return 'La cuota no tiene saldo pendiente para descontar.'
    if (!(numericValue > 0)) return mode === 'porcentaje' ? 'Ingresá un porcentaje.' : 'Ingresá un monto.'
    if (mode === 'porcentaje' && (numericValue < 1 || numericValue > 100)) return 'El porcentaje debe estar entre 1% y 100%.'
    if (mode === 'fijo' && numericValue > base) return `El monto no puede superar el total de la cuota (${formatAmount(base)}).`
    if (!isScholarship && requestedAmount > remaining) return `El descuento no puede superar lo que falta pagar (${formatAmount(remaining)}).`
    return ''
  })()

  const formErrors = {
    cuota: !cuota ? 'Elegí una cuota.' : '',
    value: cuota ? valueError : '',
    startDate: !startDate ? 'Indicá la fecha de alta del beneficio.' : '',
    endDate: isScholarship && !endDate
      ? 'Indicá hasta cuándo rige la beca.'
      : isScholarship && endDate < startDate ? 'La finalización no puede ser anterior a la fecha de alta.' : '',
    reason: !reason.trim() ? 'Indicá el motivo del beneficio.' : '',
  }
  const isValid = Object.values(formErrors).every((error) => !error)

  const selectCuota = (id) => {
    setCuotaId(id)
    setSubmitError('')
  }

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
      await postBeneficio(cuota.cuota_id, {
        tipo: isScholarship ? 'Beca' : 'Descuento',
        modalidad: mode === 'porcentaje' ? 'Porcentaje' : 'MontoFijo',
        valor: numericValue,
        fecha_aplicacion: startDate,
        ...(isScholarship && { fecha_fin: endDate }),
        motivo: reason.trim(),
      })
      onSuccess?.()
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'No se pudo aplicar el beneficio.'))
    } finally {
      setSaving(false)
    }
  }

  const noCuota = !cuota
  const stepOffset = askCuota ? 1 : 0
  const fieldError = (key) => showErrors && formErrors[key]

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
        <div className="flex flex-col gap-8 min-w-0">
          {askCuota && (
            <StepSection
              step={1}
              title="Cuota"
              description={socio ? 'Elegí la cuota sobre la que se calcula el beneficio.' : 'Cargando las cuotas del socio...'}
              disabled={!socio}
            >
              <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
                {openCuotas.length
                  ? openCuotas.map((item) => (
                    <CuotaChoice key={item.cuota_id} cuota={item} selected={item.cuota_id === cuotaId} onSelect={selectCuota} />
                  ))
                  : (
                    <p className="text-base text-on-surface-variant text-center py-6 border border-dashed border-outline-variant/40 rounded-lg">
                      {socio ? 'El socio no tiene cuotas vencidas ni en fecha.' : 'Las cuotas del socio aparecerán aquí.'}
                    </p>
                  )}
              </div>
              {fieldError('cuota') && <p className="text-sm text-error" role="alert">{formErrors.cuota}</p>}
            </StepSection>
          )}

          <StepSection
            step={1 + stepOffset}
            title="Tipo de beneficio"
            description={noCuota ? 'Primero elegí una cuota.' : paid ? 'La cuota ya está paga, por eso solo admite una beca para los próximos períodos.' : 'Elegí si es un descuento puntual o una beca con vigencia.'}
            disabled={noCuota}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {KINDS.map((option) => (
                <KindOption
                  key={option.value}
                  kind={option}
                  selected={!noCuota && selectedKind === option.value}
                  disabled={option.value === 'descuento' && paid}
                  onSelect={setKind}
                />
              ))}
            </div>
          </StepSection>

          <StepSection
            step={2 + stepOffset}
            title="Monto"
            description={noCuota ? 'Primero elegí una cuota.' : isScholarship ? 'Indicá un monto fijo o un porcentaje del total de la cuota.' : `Indicá un monto fijo o un porcentaje del total de la cuota, hasta ${formatAmount(remaining)}.`}
            disabled={noCuota}
          >
            <div className="flex flex-col gap-3 p-4 rounded-lg border border-outline-variant/40 bg-surface-container-lowest">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="inline-flex self-start p-1 rounded-lg bg-surface-container-low border border-outline-variant/40" role="group" aria-label="Modalidad">
                  {MODES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => changeMode(option.value)}
                      aria-pressed={mode === option.value}
                      className={`h-8 px-3 rounded-md text-sm font-semibold transition-colors cursor-pointer ${mode === option.value ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="relative w-full sm:w-48">
                  {mode === 'fijo' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-outline" aria-hidden="true">$</span>}
                  <input
                    type="number"
                    inputMode="decimal"
                    min={mode === 'porcentaje' ? '1' : '0.01'}
                    max={mode === 'porcentaje' ? '100' : undefined}
                    step={mode === 'porcentaje' ? '1' : '0.01'}
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    placeholder={mode === 'porcentaje' ? '0' : '0.00'}
                    aria-label={mode === 'porcentaje' ? 'Porcentaje del beneficio' : 'Monto del beneficio'}
                    aria-invalid={Boolean(fieldError('value')) || undefined}
                    className={`${FIELD_CLASS} ${NO_SPINNER_CLASS} ${mode === 'fijo' ? 'pl-7 pr-3' : 'pl-3 pr-8'} font-semibold text-right ${fieldError('value') ? 'border-error' : 'border-outline-variant/50'}`}
                  />
                  {mode === 'porcentaje' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base text-outline" aria-hidden="true">%</span>}
                </div>
              </div>
              {mode === 'porcentaje' && requestedAmount > 0 && (
                <p className="text-sm text-on-surface-variant">Equivale a <strong className="text-on-surface">{formatAmount(requestedAmount)}</strong> sobre {formatAmount(base)}.</p>
              )}
            </div>
            {fieldError('value') && <p className="text-sm text-error" role="alert">{formErrors.value}</p>}
          </StepSection>

          <StepSection
            step={3 + stepOffset}
            title={isScholarship ? 'Vigencia y motivo' : 'Fecha y motivo'}
            description={noCuota ? 'Primero elegí una cuota.' : isScholarship ? 'La beca se aplica a las cuotas de los períodos dentro de su vigencia.' : 'Registrá desde cuándo rige y por qué se otorga.'}
            disabled={noCuota}
          >
            <div className="flex flex-col gap-4 p-4 rounded-lg border border-outline-variant/40 bg-surface-container-lowest">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel htmlFor="benefit-start">Fecha de alta</FieldLabel>
                  <input
                    id="benefit-start"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className={`${FIELD_CLASS} px-3 ${fieldError('startDate') ? 'border-error' : 'border-outline-variant/50'}`}
                  />
                  {fieldError('startDate') && <p className="text-sm text-error" role="alert">{formErrors.startDate}</p>}
                </div>
                {isScholarship && (
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel htmlFor="benefit-end">Vigente hasta</FieldLabel>
                    <input
                      id="benefit-end"
                      type="date"
                      min={startDate}
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      className={`${FIELD_CLASS} px-3 ${fieldError('endDate') ? 'border-error' : 'border-outline-variant/50'}`}
                    />
                    {fieldError('endDate') && <p className="text-sm text-error" role="alert">{formErrors.endDate}</p>}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="benefit-reason">Motivo</FieldLabel>
                <textarea
                  id="benefit-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={REASON_MAX_LENGTH}
                  rows={3}
                  placeholder="Ej: Hermanos en el club"
                  className={`w-full px-3 py-2 bg-surface-container-low rounded-lg border text-base text-on-surface placeholder:text-outline resize-none focus:outline-none focus:border-primary ${fieldError('reason') ? 'border-error' : 'border-outline-variant/50'}`}
                />
                <div className="flex justify-between gap-3">
                  {fieldError('reason') ? <p className="text-sm text-error" role="alert">{formErrors.reason}</p> : <span />}
                  <span className="text-xs text-on-surface-variant">{reason.length}/{REASON_MAX_LENGTH}</span>
                </div>
              </div>
            </div>
          </StepSection>
        </div>

        <aside className="lg:sticky lg:top-4 flex flex-col gap-6 p-6 rounded-xl border border-outline-variant/30 bg-surface-container-low" aria-labelledby="benefit-summary-title">
          <h3 id="benefit-summary-title" className="text-xl font-bold text-on-surface">Resumen del beneficio</h3>

          {cuota ? (
            <div className="flex flex-col gap-2.5">
              <h4 className={SUMMARY_GROUP_CLASS}>Cuota {formatPeriod(cuota.periodo)}</h4>
              <SummaryLine label="Total sin recargo" value={formatAmount(base)} />
              {discounts > 0 && <SummaryLine label="Beneficios anteriores" value={`− ${formatAmount(discounts)}`} />}
              {paidWithoutFees > 0 && <SummaryLine label="Pagado" value={`− ${formatAmount(paidWithoutFees)}`} />}
              <SummaryLine label={isScholarship ? 'Beca' : 'Descuento'} value={`− ${formatAmount(appliedAmount)}`} />
              {unpaidFees > 0 && <SummaryLine label="Recargo por mora pendiente" value={`+ ${formatAmount(unpaidFees)}`} />}
              <div className="pt-3 mt-1 border-t border-outline-variant/30">
                <SummaryLine label="Nuevo saldo pendiente" value={formatAmount(newPending)} isTotal />
              </div>
              {!paid && newPending <= 0 && appliedAmount > 0 && (
                <p className="mt-2 flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm font-semibold text-emerald-700">
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">task_alt</span>
                  La cuota quedará registrada como paga.
                </p>
              )}
              {scholarshipCapped && (
                <p className="mt-2 p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-sm text-on-surface-variant">
                  La beca supera lo que falta pagar: en esta cuota se aplicarán {formatAmount(remaining)}. En los próximos períodos se aplicará completa.
                </p>
              )}
              {paid && (
                <p className="mt-2 p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-sm text-on-surface-variant">
                  Esta cuota ya está paga, así que no cambia. La beca se aplicará a las cuotas de los próximos períodos dentro de su vigencia.
                </p>
              )}
            </div>
          ) : (
            <p className="text-base text-on-surface-variant">Ninguna cuota seleccionada.</p>
          )}

          {submitError && <p className="text-sm text-error bg-error-container p-3 rounded-lg" role="alert">{submitError}</p>}

          <div className="mt-2 flex flex-col gap-3 [&>button]:justify-center">
            <PrimaryButton type="submit" disabled={!socio || saving}>
              {saving ? 'Aplicando...' : `Aplicar ${isScholarship ? 'beca' : 'descuento'}${requestedAmount > 0 ? ` · ${formatAmount(requestedAmount)}` : ''}`}
            </PrimaryButton>
            <SecondaryButton icon="close" onClick={onCancel} disabled={saving}>Cancelar</SecondaryButton>
          </div>
        </aside>
      </div>
    </form>
  )
}

export default BenefitForm
