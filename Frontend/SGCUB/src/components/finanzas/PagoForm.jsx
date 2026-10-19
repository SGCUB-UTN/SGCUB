import { useId, useMemo, useState } from 'react'
import { collectErrorMessages, formatAmount, formatDate, formatDni, formatNumber } from '../personas/format'
import { PrimaryButton, SecondaryButton } from '../personas/tabs/parts'
import { formatPeriod } from '../shared/periodFormat'
import { BenefitButton } from '../personas/HeaderPersona'
import ComprobantePago from './ComprobantePago'
import { FIELD_CLASS, NO_SPINNER_CLASS, StepSection, SUMMARY_GROUP_CLASS, SummaryLine } from './formParts'
import { cuotaStateBadgeClass, cuotaStateLabel, isOverdue } from './cuotaStates'
import { registrarPago } from '../../api/pagos'
import { getComprobante } from '../../api/comprobantes'

const PAYMENT_METHODS = [
  { value: 'Efectivo', label: 'Efectivo', icon: 'payments' },
  { value: 'Transferencia', label: 'Transferencia', icon: 'account_balance' },
  { value: 'BilleteraVirtual', label: 'Billetera virtual', icon: 'wallet' },
]

const methodLabel = (value) => PAYMENT_METHODS.find((option) => option.value === value)?.label ?? value

const roundCents = (value) => Math.round(value * 100) / 100

const amountInput = (value) => (value > 0 ? roundCents(value).toFixed(2) : '')

const emptyPaymentRow = (monto = '') => ({ medio: '', monto, edited: false })

const isRowComplete = (row) => Boolean(row.medio) && Number(row.monto) > 0

const todayIso = () => {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

const lateFee = (cuota) => (cuota.items ?? [])
  .filter((item) => !item.es_descuento && String(item.concepto ?? '').toLowerCase() === 'mora')
  .reduce((total, item) => total + Number(item.monto || 0), 0)

const dueText = (cuota, today) => {
  const first = cuota.fecha_venc1?.split('T')[0]
  const second = cuota.fecha_venc2?.split('T')[0]
  if (!first) return 'Sin fecha de vencimiento'
  if (first >= today) return `Vence el ${formatDate(first)}`
  if (second && second >= today) return `Venció el ${formatDate(first)} · 2° vencimiento ${formatDate(second)}`
  return `Venció el ${formatDate(first)}`
}

const LINK_BUTTON_CLASS = 'inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-semibold text-primary hover:bg-primary/5 transition-colors cursor-pointer'

function CuotaOption({ cuota, today, selected, onToggle }) {
  const total = Number(cuota.monto_total || 0)
  const fee = lateFee(cuota)
  const paid = Number(cuota.monto_pagado || 0)
  const pending = Number(cuota.saldo_pendiente || 0)
  const overdue = isOverdue(cuota)

  const breakdown = [
    `Cuota ${formatAmount(total - fee)}`,
    fee > 0 && `Recargo + ${formatAmount(fee)}`,
    paid > 0 && `Pagado − ${formatAmount(paid)}`,
  ].filter(Boolean)

  return (
    <label className={`flex items-center gap-3 p-3 sm:p-4 rounded-lg border cursor-pointer transition-colors ${selected ? 'border-primary bg-primary/5' : 'border-outline-variant/40 bg-surface-container-lowest hover:bg-surface-container-low'}`}>
      <input
        type="checkbox"
        checked={selected}
        onChange={(event) => onToggle(cuota.cuota_id, event.target.checked)}
        className="h-4 w-4 accent-primary shrink-0"
      />
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base font-semibold text-on-surface">Cuota {formatPeriod(cuota.periodo)}</span>
          {overdue && (
            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${cuotaStateBadgeClass(cuota.estado_cuota)}`}>{cuotaStateLabel(cuota.estado_cuota)}</span>
          )}
        </div>
        <span className={`text-sm ${overdue ? 'text-error' : 'text-on-surface-variant'}`}>{dueText(cuota, today)}</span>
        {breakdown.length > 1 && (
          <span className="text-xs text-on-surface-variant mt-0.5">{breakdown.join(' · ')}</span>
        )}
      </div>
      <div className="text-right shrink-0">
        <span className="block text-xs text-on-surface-variant">Saldo</span>
        <span className="text-base font-bold text-on-surface">{formatAmount(pending)}</span>
      </div>
    </label>
  )
}

function PaymentRow({ row, index, takenMethods, missingAmount, canRemove, showErrors, onChange, onRemove }) {
  const methodError = showErrors && !row.medio
  const amountError = showErrors && !(Number(row.monto) > 0)
  const showFill = missingAmount > 0 && roundCents(missingAmount) !== roundCents(Number(row.monto || 0))

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <select
            value={row.medio}
            onChange={(event) => onChange({ medio: event.target.value })}
            aria-label={`Medio de pago ${index + 1}`}
            aria-invalid={methodError || undefined}
            className={`${FIELD_CLASS} pl-3 pr-9 appearance-none cursor-pointer ${methodError ? 'border-error' : 'border-outline-variant/50'}`}
          >
            <option value="">Seleccioná un medio</option>
            {PAYMENT_METHODS.map((method) => (
              <option key={method.value} value={method.value} disabled={takenMethods.includes(method.value)}>
                {method.label}
              </option>
            ))}
          </select>
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" style={{ fontSize: 18 }} aria-hidden="true">
            expand_more
          </span>
        </div>

        <div className="relative w-36 sm:w-48 shrink-0">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-outline" aria-hidden="true">$</span>
          <input
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={row.monto}
            onChange={(event) => onChange({ monto: event.target.value, edited: true })}
            placeholder="0.00"
            aria-label={`Monto del medio de pago ${index + 1}`}
            aria-invalid={amountError || undefined}
            className={`${FIELD_CLASS} ${NO_SPINNER_CLASS} pl-7 pr-3 font-semibold text-right ${amountError ? 'border-error' : 'border-outline-variant/50'}`}
          />
        </div>

        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            title="Quitar medio de pago"
            aria-label={`Quitar medio de pago ${index + 1}`}
            className="w-10 h-10 shrink-0 rounded-lg text-outline hover:text-error hover:bg-error-container flex items-center justify-center transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">delete</span>
          </button>
        )}
      </div>

      {showFill && (
        <button
          type="button"
          onClick={() => onChange({ monto: amountInput(missingAmount), edited: true })}
          className={`self-end ${LINK_BUTTON_CLASS} ${canRemove ? 'mr-12' : ''}`}
        >
          Completar con {formatAmount(missingAmount)}
        </button>
      )}
    </div>
  )
}

const NO_CUOTAS = []

const pendingTotal = (cuotas, ids) => roundCents(cuotas
  .filter((cuota) => ids.includes(cuota.cuota_id))
  .reduce((total, cuota) => total + Number(cuota.saldo_pendiente || 0), 0))

// Without `socio`, renders the empty layout (disabled steps, empty summary) with `emptyHeader`
// in place of the socio data, so the payment modal keeps its shape while a socio is chosen.
function PagoForm({ socio = null, cuenta = null, emptyHeader = null, initialCuotaIds = NO_CUOTAS, onCancel, onSuccess, onAssignBenefit }) {
  const today = todayIso()
  const pendingCuotas = useMemo(
    () => (cuenta?.cuotas ?? [])
      .filter((cuota) => Number(cuota.saldo_pendiente ?? 0) > 0)
      .sort((a, b) => String(a.periodo).localeCompare(String(b.periodo))),
    [cuenta],
  )
  const [selectedIds, setSelectedIds] = useState(
    () => pendingCuotas.map((cuota) => cuota.cuota_id).filter((id) => initialCuotaIds.includes(id)),
  )
  const [paymentRows, setPaymentRows] = useState(() => [emptyPaymentRow(amountInput(pendingTotal(pendingCuotas, initialCuotaIds)))])
  const [observacion, setObservacion] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const totalOf = (ids) => pendingTotal(pendingCuotas, ids)

  const selectedCuotas = pendingCuotas.filter((cuota) => selectedIds.includes(cuota.cuota_id))
  const selectedTotal = totalOf(selectedIds)
  const enteredTotal = roundCents(paymentRows.reduce((total, row) => total + Number(row.monto || 0), 0))
  const difference = roundCents(enteredTotal - selectedTotal)

  // While a single payment row keeps its suggested amount, it follows the selected total
  const applySelection = (nextIds) => {
    setSelectedIds(nextIds)
    const nextTotal = totalOf(nextIds)
    setPaymentRows((rows) => (rows.length === 1 && !rows[0].edited ? [{ ...rows[0], monto: amountInput(nextTotal) }] : rows))
  }

  // A benefit applied from here reloads the account: keep the selection and follow the new balances
  const [syncedCuenta, setSyncedCuenta] = useState(cuenta)
  if (cuenta !== syncedCuenta) {
    setSyncedCuenta(cuenta)
    applySelection(selectedIds.filter((id) => pendingCuotas.some((cuota) => cuota.cuota_id === id)))
  }

  const toggleCuota = (cuotaId, checked) => {
    applySelection(checked ? [...selectedIds, cuotaId] : selectedIds.filter((id) => id !== cuotaId))
  }

  const updateRow = (index, changes) => {
    setPaymentRows((rows) => rows.map((row, position) => (position === index ? { ...row, ...changes } : row)))
  }

  const removeRow = (index) => setPaymentRows((rows) => rows.filter((_, position) => position !== index))

  const addRow = () => setPaymentRows((rows) => [...rows, emptyPaymentRow(amountInput(selectedTotal - enteredTotal))])

  const formErrors = {
    cuotas: !selectedIds.length ? 'Seleccioná al menos una cuota.' : '',
    medios: paymentRows.some((row) => !isRowComplete(row)) ? 'Elegí el medio e ingresá el monto de cada pago.' : '',
    montos: selectedIds.length && difference > 0 ? 'El pago no puede superar el total de las cuotas seleccionadas.' : '',
  }
  const isValid = !formErrors.cuotas && !formErrors.medios && !formErrors.montos

  const confirmPayment = async (event) => {
    event.preventDefault()
    if (!socio) return
    setShowErrors(true)
    if (!isValid) return
    setSaving(true)
    setSubmitError('')
    try {
      const response = await registrarPago({
        socio_id: socio.socio_id,
        cuota_ids: selectedIds,
        monto_total: enteredTotal,
        medios: paymentRows.map((row) => ({ medio_de_pago: row.medio, monto: Number(row.monto) })),
        observacion,
      })
      const detalle = await getComprobante(response.comprobante?.comprobante_id).catch(() => null)
      setReceipt({
        detalle,
        medios: paymentRows.map((row) => ({ medio: methodLabel(row.medio), monto: Number(row.monto) })),
        montoTotal: enteredTotal,
        observacion,
        numero: response.comprobante?.numero,
        fecha: response.comprobante?.fecha_emision,
      })
      onSuccess?.(response)
    } catch (error) {
      setSubmitError(collectErrorMessages(error.response?.data).join(' ') || 'No se pudo registrar el pago.')
    } finally {
      setSaving(false)
    }
  }

  if (receipt) {
    return <ComprobantePago socio={socio} {...receipt} onBack={onCancel} />
  }

  const noCuotasSelected = selectedIds.length === 0

  return (
    <form onSubmit={confirmPayment} className="flex flex-col gap-6" noValidate>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 pb-4 border-b border-outline-variant/30">
        <div className="min-w-0">
          <p className="text-sm uppercase tracking-wider font-semibold text-primary">Registrar pago de</p>
          {socio ? (
            <>
              <h2 className="text-xl font-bold text-on-surface truncate">{socio.apellido}, {socio.nombre}</h2>
              <p className="text-base text-on-surface-variant">DNI {formatDni(socio.dni)} · Socio {formatNumber(socio.numero_socio)}</p>
            </>
          ) : (
            <div className="mt-1">{emptyHeader}</div>
          )}
        </div>
        <BenefitButton onClick={onAssignBenefit} disabled={!socio || !onAssignBenefit} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
        <div className="flex flex-col gap-8 min-w-0">
          <StepSection
            step={1}
            title="Cuotas a cobrar"
            description={socio ? 'Marcá las cuotas que el socio va a pagar.' : 'Primero elegí un socio.'}
            disabled={!socio}
          >
            <div className="flex flex-col gap-2">
              {pendingCuotas.length
                ? pendingCuotas.map((cuota) => (
                  <CuotaOption
                    key={cuota.cuota_id}
                    cuota={cuota}
                    today={today}
                    selected={selectedIds.includes(cuota.cuota_id)}
                    onToggle={toggleCuota}
                  />
                ))
                : (
                  <p className="text-base text-on-surface-variant text-center py-6 border border-dashed border-outline-variant/40 rounded-lg">
                    {socio ? 'El socio no tiene cuotas pendientes.' : 'Las cuotas pendientes del socio aparecerán aquí.'}
                  </p>
                )}
            </div>
            {showErrors && formErrors.cuotas && <p className="text-sm text-error" role="alert">{formErrors.cuotas}</p>}
          </StepSection>

          <StepSection
            step={2}
            title="Forma de pago"
            description={noCuotasSelected ? 'Primero seleccioná al menos una cuota.' : 'Elegí el medio y el monto. Si paga con más de un medio, agregá otro.'}
            disabled={noCuotasSelected}
          >
            <div className="flex flex-col gap-3 p-4 rounded-lg border border-outline-variant/40 bg-surface-container-lowest">
              <div className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant" aria-hidden="true">
                <span className="flex-1">Medio de pago</span>
                <span className="w-36 sm:w-48 shrink-0">Monto</span>
                {paymentRows.length > 1 && <span className="w-10 shrink-0" />}
              </div>
              {paymentRows.map((row, index) => (
                <PaymentRow
                  key={index}
                  row={row}
                  index={index}
                  takenMethods={paymentRows.filter((_, position) => position !== index).map((other) => other.medio).filter(Boolean)}
                  missingAmount={roundCents(selectedTotal - (enteredTotal - Number(row.monto || 0)))}
                  canRemove={paymentRows.length > 1}
                  showErrors={showErrors}
                  onChange={(changes) => updateRow(index, changes)}
                  onRemove={() => removeRow(index)}
                />
              ))}
              {paymentRows.length < PAYMENT_METHODS.length && (
                <div className="pt-1">
                  <SecondaryButton icon="add" onClick={addRow}>Agregar medio de pago</SecondaryButton>
                </div>
              )}
            </div>
            {showErrors && formErrors.medios && <p className="text-sm text-error" role="alert">{formErrors.medios}</p>}
          </StepSection>
        </div>

        <aside className="lg:sticky lg:top-4 flex flex-col gap-6 p-6 rounded-xl border border-outline-variant/30 bg-surface-container-low" aria-labelledby="payment-summary-title">
          <h3 id="payment-summary-title" className="text-xl font-bold text-on-surface">Resumen del cobro</h3>

          <div className="flex flex-col gap-2.5">
            <h4 className={SUMMARY_GROUP_CLASS}>Cuotas</h4>
            {selectedCuotas.length
              ? selectedCuotas.map((cuota) => (
                <SummaryLine key={cuota.cuota_id} label={`Cuota ${formatPeriod(cuota.periodo)}`} value={formatAmount(Number(cuota.saldo_pendiente || 0))} />
              ))
              : <p className="text-base text-on-surface-variant">Ninguna cuota seleccionada.</p>}
            <div className="pt-3 mt-1 mb-4  border-t border-outline-variant/30">
              <SummaryLine label="Total de cuotas" value={formatAmount(selectedTotal)} isTotal />
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <hr className="-mx-6 border-t border-outline-variant/50" />
            <h4 className={SUMMARY_GROUP_CLASS}>Medios de pago</h4>
            {paymentRows.some(isRowComplete)
              ? paymentRows.filter(isRowComplete).map((row) => (
                <SummaryLine key={row.medio} label={methodLabel(row.medio)} value={formatAmount(Number(row.monto))} />
              ))
              : <p className="text-base text-on-surface-variant">Ningún medio de pago cargado.</p>}
            <div className="pt-3 mt-1 mb-4 border-t border-outline-variant/30">
              <SummaryLine label="Total pagado" value={formatAmount(enteredTotal)} isTotal />
            </div>
          </div>

          <hr className="-mx-6 border-t border-outline-variant/50" />

          <label className="mt-4 flex flex-col gap-2">
            <span className="text-sm font-semibold text-on-surface-variant">Observaciones <span className="font-normal text-outline">(opcional)</span></span>
            <textarea
              value={observacion}
              onChange={(event) => setObservacion(event.target.value)}
              disabled={!socio}
              maxLength={200}
              rows={3}
              placeholder="Detalle adicional del pago"
              className="w-full px-3 py-2 bg-surface-container-lowest rounded-lg border border-outline-variant/40 text-base text-on-surface placeholder:text-outline resize-none focus:outline-none focus:border-primary"
            />
          </label>

          {submitError && <p className="text-sm text-error bg-error-container p-3 rounded-lg" role="alert">{submitError}</p>}

          <div className="mt-2 flex flex-col gap-3 [&>button]:justify-center">
            <PrimaryButton icon={saving ? 'progress_activity' : 'payments'} type="submit" disabled={!socio || saving || difference > 0}>
              {saving ? 'Registrando...' : `Confirmar pago · ${formatAmount(enteredTotal)}`}
            </PrimaryButton>
            <SecondaryButton icon="close" onClick={onCancel}>Cancelar</SecondaryButton>
          </div>
        </aside>
      </div>
    </form>
  )
}

export default PagoForm
