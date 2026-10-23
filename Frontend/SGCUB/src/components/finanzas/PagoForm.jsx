import { Fragment, useMemo, useState } from 'react'
import { collectErrorMessages, formatAmount, formatDate } from '../personas/format'
import { formatPeriod } from '../shared/periodFormat'
import DataTable from '../shared/DataTable'
import { claseInput } from '../socios/socioForm'
import { SelectConFlecha } from '../socios/SocioFormFields'
import ComprobantePago from './ComprobantePago'
import LateFeeWaiverModal from './LateFeeWaiverModal'
import { FormSection, NO_SPINNER_CLASS, SUBMIT_BUTTON_CLASS, SummaryLine, TICKET_CLASS, TicketSection } from './formParts'
import { cuotaStateLabel, isOverdue } from './cuotaStates'
import { registrarPago } from '../../api/pagos'
import { getComprobante } from '../../api/comprobantes'

const PAYMENT_METHODS = [
  { value: 'Efectivo', label: 'Efectivo', icon: 'payments' },
  { value: 'Transferencia', label: 'Transferencia', icon: 'account_balance' },
  { value: 'BilleteraVirtual', label: 'Billetera virtual', icon: 'wallet' },
]

const LATE_FEE_CONCEPT = 'Mora'

const LATE_FEE_WAIVER_CONCEPT = 'CondonacionMora'

const COLUMN_COUNT = 4

const methodLabel = (value) => PAYMENT_METHODS.find((option) => option.value === value)?.label ?? value

const roundCents = (value) => Math.round(value * 100) / 100

const amountInput = (value) => (value > 0 ? roundCents(value).toFixed(2) : '')

const emptyPaymentRow = (monto = '') => ({ medio: '', monto, edited: false })

const isRowComplete = (row) => Boolean(row.medio) && Number(row.monto) > 0

const sumItems = (cuota, predicate) => (cuota.items ?? [])
  .filter(predicate)
  .reduce((total, item) => total + Number(item.monto || 0), 0)

const lateFee = (cuota) => roundCents(
  sumItems(cuota, (item) => !item.es_descuento && item.concepto === LATE_FEE_CONCEPT)
  - sumItems(cuota, (item) => item.concepto === LATE_FEE_WAIVER_CONCEPT),
)

const unpaidLateFee = (cuota) => roundCents(Math.max(
  Number(cuota.saldo_pendiente || 0) - Number(cuota.saldo_sin_recargo ?? cuota.saldo_pendiente ?? 0),
  0,
))

const canWaive = (cuota) => isOverdue(cuota) && unpaidLateFee(cuota) > 0

const cuotaDue = (cuota, waived) => roundCents(Number(cuota.saldo_pendiente || 0) - (waived ? unpaidLateFee(cuota) : 0))

const allocate = (cuotas, waivedIds, amount) => {
  let remaining = amount
  return cuotas.map((cuota) => {
    const waived = waivedIds.includes(cuota.cuota_id)
    const due = cuotaDue(cuota, waived)
    const applied = roundCents(Math.min(Math.max(remaining, 0), due))
    remaining = roundCents(remaining - applied)
    return { cuota, waived, due, applied, fee: waived ? unpaidLateFee(cuota) : 0 }
  })
}

const firstCuotasTotal = (cuotas, waivedIds, count) => roundCents(cuotas
  .slice(0, count)
  .reduce((total, cuota) => total + cuotaDue(cuota, waivedIds.includes(cuota.cuota_id)), 0))

const ACTION_BUTTON_CLASS = 'inline-flex items-center justify-center p-1 rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'

function ActionButton({ icon, label, active = false, disabled = false, onClick }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      className={`${ACTION_BUTTON_CLASS} ${active ? 'bg-primary/10 text-primary' : 'text-primary hover:bg-primary-fixed/30'}`}
    >
      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{icon}</span>
    </button>
  )
}

function BreakdownLine({ label, value, tone = 'text-on-surface-variant', strong = false }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 text-base ${tone} ${strong ? 'font-bold' : ''}`}>
      <span>{label}</span>
      <span className="tabular-nums whitespace-nowrap">{value}</span>
    </div>
  )
}

function CuotaBreakdownRow({ line, editing, onWaiveChange }) {
  const { cuota, waived, due, applied } = line
  const fee = lateFee(cuota)
  const unpaidFee = unpaidLateFee(cuota)
  const paid = Number(cuota.monto_pagado || 0)
  const total = Number(cuota.monto_total || 0)

  return (
    <tr className="bg-surface-container-low/40">
      <td colSpan={COLUMN_COUNT} className="px-4 py-3 sm:pl-12">
        <div className="flex flex-col gap-2.5 max-w-xl">
          <div className="flex flex-col gap-1.5">
            <BreakdownLine label="1° vencimiento" value={formatDate(cuota.fecha_venc1)} />
            <BreakdownLine label="2° vencimiento" value={formatDate(cuota.fecha_venc2)} />
          </div>
          <div className="flex flex-col gap-1.5 pt-3 border-t border-outline-variant/30">
            <BreakdownLine label="Cuota" value={formatAmount(roundCents(total - fee))} tone="text-on-surface" />
            {fee > 0 && <BreakdownLine label="Recargo por mora" value={`+ ${formatAmount(fee)}`} tone="text-error" />}
            {waived && <BreakdownLine label="Condonación de recargo" value={`− ${formatAmount(unpaidFee)}`} tone="text-emerald-700" />}
            {paid > 0 && <BreakdownLine label="Pagado" value={`− ${formatAmount(paid)}`} />}
            <div className="pt-2 mt-1 border-t border-outline-variant/30">
              <BreakdownLine label="Total" value={formatAmount(due)} tone="text-on-surface" strong />
            </div>
          </div>
          {editing && (
            <div className="flex flex-col gap-1.5 pt-3 border-t border-outline-variant/30">
              <label className="self-start flex items-center gap-2 text-base font-semibold text-on-surface cursor-pointer">
                <input
                  type="checkbox"
                  checked={waived}
                  onChange={(event) => onWaiveChange(cuota, event.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                Eximir recargo por mora
              </label>
              {waived && applied <= 0 && (
                <p className="text-sm text-on-surface-variant">El recargo se exime solo si el pago alcanza a esta cuota.</p>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

function CuotasTable({ lines, debtTotal, period, showFuture, onToggleFuture, expandedIds, editingIds, onToggleExpand, onToggleEdit, onWaiveChange, onAssignBenefit }) {
  const handleKeyDown = (event, cuotaId) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onToggleExpand(cuotaId)
    }
  }

  const dueLines = lines.filter((line) => !isFuture(line.cuota, period))
  const futureLines = lines.filter((line) => isFuture(line.cuota, period))
  const renderLine = (line) => (
    <CuotaLine
      key={line.cuota.cuota_id}
      line={line}
      expandedIds={expandedIds}
      editingIds={editingIds}
      onToggleExpand={onToggleExpand}
      onToggleEdit={onToggleEdit}
      onWaiveChange={onWaiveChange}
      onAssignBenefit={onAssignBenefit}
      onKeyDown={handleKeyDown}
    />
  )

  return (
    <DataTable
      className="border border-outline-variant/30 rounded-lg bg-surface-container-lowest shadow-sm"
      tableClassName="min-w-[560px]"
      headers={(
        <>
          <th className="py-1.5 pl-3 pr-0 w-8 text-xs" scope="col"><span className="sr-only">Desglose</span></th>
          <th className="py-1.5 px-3 text-xs" scope="col">Período</th>
          <th className="py-1.5 px-3 text-xs text-right" scope="col">Total</th>
          <th className="py-1.5 px-3 text-xs text-center w-20" scope="col">Acciones</th>
        </>
      )}
      footer={(
        <>
          <td className="py-2 pl-3 pr-0" />
          <th className="py-2 px-3 text-base font-semibold text-on-surface-variant" scope="row">Deuda total</th>
          <td className="py-2 px-3 text-right text-base font-bold text-on-surface">{formatAmount(debtTotal)}</td>
          <td className="py-2 px-3" />
        </>
      )}
    >
      {dueLines.length === 0 && (
        <tr>
          <td colSpan={COLUMN_COUNT} className="py-3 px-4 text-center text-base text-on-surface-variant">
            No hay cuotas vencidas ni del mes actual.
          </td>
        </tr>
      )}
      {dueLines.map(renderLine)}
      {futureLines.length > 0 && (
        <tr>
          <td colSpan={COLUMN_COUNT} className="py-1 px-3">
            <button
              type="button"
              onClick={onToggleFuture}
              aria-expanded={showFuture}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-semibold text-primary hover:bg-primary/5 transition-colors cursor-pointer"
            >
              <span className={`material-symbols-outlined text-[18px] transition-transform ${showFuture ? 'rotate-180' : ''}`} aria-hidden="true">expand_more</span>
              {showFuture ? 'Ocultar cuotas futuras' : `Ver cuotas futuras (${futureLines.length})`}
            </button>
          </td>
        </tr>
      )}
      {showFuture && futureLines.map(renderLine)}
    </DataTable>
  )
}

function CuotaLine({ line, expandedIds, editingIds, onToggleExpand, onToggleEdit, onWaiveChange, onAssignBenefit, onKeyDown }) {
  const { cuota, due, applied } = line
  const cuotaId = cuota.cuota_id
  const expanded = expandedIds.includes(cuotaId)
  const editing = editingIds.includes(cuotaId)
  const partial = applied > 0 && applied < due
  return (
    <Fragment>
      <tr
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => onToggleExpand(cuotaId)}
        onKeyDown={(event) => onKeyDown(event, cuotaId)}
        className={`cursor-pointer transition-colors ${expanded ? 'bg-primary/5' : 'hover:bg-surface-container-low'}`}
      >
        <td className="py-1.5 pl-3 pr-0 text-outline">
          <span className={`material-symbols-outlined text-[20px] align-middle transition-transform ${expanded ? 'rotate-180 text-primary' : ''}`} aria-hidden="true">expand_more</span>
        </td>
        <td className="py-1.5 px-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-on-surface text-base">{formatPeriod(cuota.periodo)}</span>
            {isOverdue(cuota) && (
              <span className="w-2 h-2 rounded-full bg-error shrink-0" title={cuotaStateLabel(cuota.estado_cuota)}>
                <span className="sr-only">{cuotaStateLabel(cuota.estado_cuota)}</span>
              </span>
            )}
          </div>
        </td>
        <td className="py-1.5 px-3 text-right">
          <span className="block font-semibold text-on-surface text-base">{formatAmount(due)}</span>
          {partial && <span className="block text-xs text-sky-700">Quedan {formatAmount(roundCents(due - applied))}</span>}
        </td>
        <td className="py-1.5 px-3">
          <div className="flex items-center justify-center gap-0.5">
            <ActionButton
              icon="edit"
              label={canWaive(cuota) ? `Eximir recargo de ${formatPeriod(cuota.periodo)}` : 'La cuota no tiene recargo por mora para eximir'}
              active={editing}
              disabled={!canWaive(cuota)}
              onClick={() => onToggleEdit(cuotaId)}
            />
            <ActionButton
              icon="sell"
              label={`Asignar descuento a ${formatPeriod(cuota.periodo)}`}
              disabled={!onAssignBenefit}
              onClick={() => onAssignBenefit(cuotaId)}
            />
          </div>
        </td>
      </tr>
      {expanded && <CuotaBreakdownRow line={line} editing={editing} onWaiveChange={onWaiveChange} />}
    </Fragment>
  )
}

const ROW_ICON_BUTTON_CLASS = 'w-11 h-11 shrink-0 rounded-lg flex items-center justify-center transition-colors cursor-pointer'

function PaymentRow({ row, index, takenMethods, canRemove, showActionSlot, showErrors, onChange, onRemove }) {
  const methodError = showErrors && !row.medio
  const amountError = showErrors && !(Number(row.monto) > 0)

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <SelectConFlecha
          value={row.medio}
          onChange={(event) => onChange({ medio: event.target.value })}
          aria-label={`Medio de pago ${index + 1}`}
          conError={methodError}
        >
          <option value="">Seleccioná un medio</option>
          {PAYMENT_METHODS.map((method) => (
            <option key={method.value} value={method.value} disabled={takenMethods.includes(method.value)}>
              {method.label}
            </option>
          ))}
        </SelectConFlecha>
      </div>

      <div className="relative w-36 sm:w-48 shrink-0">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base text-outline" aria-hidden="true">$</span>
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
          className={claseInput(amountError, `${NO_SPINNER_CLASS} pl-7 font-semibold text-right`)}
        />
      </div>

      {showActionSlot && (
        <div className="w-11 shrink-0">
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              title="Quitar medio de pago"
              aria-label={`Quitar medio de pago ${index + 1}`}
              className={`${ROW_ICON_BUTTON_CLASS} text-error hover:bg-error-container/60`}
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">delete</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const NO_CUOTAS = []

const currentPeriod = () => {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
}

const isFuture = (cuota, period) => String(cuota.periodo) > period

const initialCount = (cuotas, ids, period) => {
  const lastIndex = cuotas.reduce((last, cuota, index) => (ids.includes(cuota.cuota_id) ? index : last), -1)
  return lastIndex >= 0 ? lastIndex + 1 : cuotas.filter((cuota) => !isFuture(cuota, period)).length
}

const toggleId = (ids, id) => (ids.includes(id) ? ids.filter((current) => current !== id) : [...ids, id])

// Without `socio`, renders the empty layout (disabled sections, empty summary)
// so the payment modal keeps its shape while a socio is chosen.
function PagoForm({ socio = null, cuenta = null, initialCuotaIds = NO_CUOTAS, onCancel, onSuccess, onAssignBenefit }) {
  const pendingCuotas = useMemo(
    () => (cuenta?.cuotas ?? [])
      .filter((cuota) => Number(cuota.saldo_pendiente ?? 0) > 0)
      .sort((a, b) => String(a.periodo).localeCompare(String(b.periodo)) || a.cuota_id - b.cuota_id),
    [cuenta],
  )
  const period = currentPeriod()
  const dueCount = pendingCuotas.filter((cuota) => !isFuture(cuota, period)).length
  const [suggestedCount] = useState(() => initialCount(pendingCuotas, initialCuotaIds, period))
  const [showFuture, setShowFuture] = useState(() => suggestedCount > dueCount)
  const [waivedIds, setWaivedIds] = useState([])
  const [waiver, setWaiver] = useState(null)
  const [waiverPrompt, setWaiverPrompt] = useState(null)
  const [expandedIds, setExpandedIds] = useState([])
  const [editingIds, setEditingIds] = useState([])
  const [paymentRows, setPaymentRows] = useState(() => [emptyPaymentRow(amountInput(firstCuotasTotal(pendingCuotas, [], suggestedCount)))])
  const [observacion, setObservacion] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const enteredTotal = roundCents(paymentRows.reduce((total, row) => total + Number(row.monto || 0), 0))
  const lines = allocate(pendingCuotas, waivedIds, enteredTotal)
  const coveredLines = lines.filter((line) => line.applied > 0)
  const waivedLines = coveredLines.filter((line) => line.waived)
  const debtTotal = roundCents(lines.filter((line) => !isFuture(line.cuota, period)).reduce((total, line) => total + line.due, 0))
  const pendingTotal = roundCents(lines.reduce((total, line) => total + line.due, 0))
  const chargeTotal = roundCents(coveredLines.reduce((total, line) => total + line.applied, 0))
  const pendingBalance = roundCents(debtTotal - enteredTotal)

  const applyWaivers = (nextWaivedIds) => {
    setWaivedIds(nextWaivedIds)
    if (!nextWaivedIds.length) setWaiver(null)
    const suggested = amountInput(firstCuotasTotal(pendingCuotas, nextWaivedIds, suggestedCount))
    setPaymentRows((rows) => (rows.length === 1 && !rows[0].edited ? [{ ...rows[0], monto: suggested }] : rows))
  }

  // A benefit applied from here reloads the account: keep the waivers and follow the new balances
  const [syncedCuenta, setSyncedCuenta] = useState(cuenta)
  if (cuenta !== syncedCuenta) {
    setSyncedCuenta(cuenta)
    applyWaivers(waivedIds.filter((id) => pendingCuotas.some((cuota) => cuota.cuota_id === id && canWaive(cuota))))
  }

  const toggleExpand = (cuotaId) => {
    setExpandedIds((ids) => toggleId(ids, cuotaId))
    if (expandedIds.includes(cuotaId)) setEditingIds((ids) => ids.filter((id) => id !== cuotaId))
  }

  const toggleEdit = (cuotaId) => {
    const editing = editingIds.includes(cuotaId)
    setEditingIds((ids) => toggleId(ids, cuotaId))
    if (!editing) setExpandedIds((ids) => (ids.includes(cuotaId) ? ids : [...ids, cuotaId]))
  }

  const changeWaiver = (cuota, checked) => {
    if (!checked) {
      applyWaivers(waivedIds.filter((id) => id !== cuota.cuota_id))
    } else if (waiver) {
      applyWaivers([...waivedIds, cuota.cuota_id])
    } else {
      setWaiverPrompt({ cuota })
    }
  }

  const confirmWaiver = (authorization) => {
    setWaiver(authorization)
    if (waiverPrompt?.cuota) applyWaivers([...waivedIds, waiverPrompt.cuota.cuota_id])
    setWaiverPrompt(null)
  }

  const updateRow = (index, changes) => {
    setPaymentRows((rows) => rows.map((row, position) => (position === index ? { ...row, ...changes } : row)))
  }

  const removeRow = (index) => setPaymentRows((rows) => rows.filter((_, position) => position !== index))

  const addRow = () => setPaymentRows((rows) => [...rows, emptyPaymentRow(amountInput(debtTotal - enteredTotal))])

  const canAddRow = paymentRows.length < PAYMENT_METHODS.length
  const showActionSlot = canAddRow || paymentRows.length > 1

  const exceedsDebt = enteredTotal > pendingTotal
  const formErrors = {
    medios: paymentRows.some((row) => !isRowComplete(row)) ? 'Elegí el medio e ingresá el monto de cada pago.' : '',
    montos: exceedsDebt ? `El pago no puede superar el total de cuotas pendientes, incluidas las futuras (${formatAmount(pendingTotal)}).` : '',
  }
  const isValid = !formErrors.medios && !formErrors.montos && coveredLines.length > 0

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
        cuota_ids: coveredLines.map((line) => line.cuota.cuota_id),
        monto_total: enteredTotal,
        medios: paymentRows.map((row) => ({ medio_de_pago: row.medio, monto: Number(row.monto) })),
        observacion,
        ...(waivedLines.length && waiver && {
          condonacion_mora: {
            cuota_ids: waivedLines.map((line) => line.cuota.cuota_id),
            autorizado_por: waiver.autorizadoPor,
            motivo: waiver.motivo,
          },
        }),
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

  const noDebt = pendingCuotas.length === 0

  const confirmLabel = () => {
    if (saving) return 'Registrando...'
    if (exceedsDebt) return `Excede las cuotas pendientes en ${formatAmount(roundCents(enteredTotal - pendingTotal))}`
    if (!(enteredTotal > 0)) return 'Ingresá el monto del pago'
    return `Confirmar pago • ${formatAmount(enteredTotal)}`
  }

  return (
    <form onSubmit={confirmPayment} className="flex flex-col" noValidate>
      <div className={`grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-stretch ${socio ? '' : 'grayscale'}`}>
        <div className="flex flex-col gap-5 min-w-0">
          <FormSection
            icon="receipt_long"
            title="Cuotas a saldar"
            disabled={!socio || noDebt}
          >
            {pendingCuotas.length ? (
              <CuotasTable
                lines={lines}
                debtTotal={debtTotal}
                period={period}
                showFuture={showFuture}
                onToggleFuture={() => setShowFuture((current) => !current)}
                expandedIds={expandedIds}
                editingIds={editingIds}
                onToggleExpand={toggleExpand}
                onToggleEdit={toggleEdit}
                onWaiveChange={changeWaiver}
                onAssignBenefit={onAssignBenefit}
              />
            ) : (
              <p className="text-base text-on-surface-variant text-center py-6 border border-dashed border-outline-variant/40 rounded-lg">
                {socio ? 'El socio no tiene cuotas pendientes.' : 'Las cuotas pendientes del socio aparecerán aquí.'}
              </p>
            )}
          </FormSection>

          <FormSection
            icon="payments"
            title="Formas de pago"
            description={socio && noDebt ? 'El socio no tiene deuda para cobrar.' : ''}
            disabled={!socio || noDebt}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 text-base font-semibold text-on-surface">
                <span className="flex-1" aria-hidden="true">Medio de pago <span className="text-error font-bold">*</span></span>
                <span className="w-36 sm:w-48 shrink-0" aria-hidden="true">Monto <span className="text-error font-bold">*</span></span>
                {showActionSlot && (
                  <div className="w-11 shrink-0 flex justify-center">
                    {canAddRow && (
                      <button
                        type="button"
                        onClick={addRow}
                        title="Agregar medio de pago"
                        aria-label="Agregar medio de pago"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-primary border border-primary/40 hover:bg-primary-fixed/30 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
              {paymentRows.map((row, index) => (
                <PaymentRow
                  key={index}
                  row={row}
                  index={index}
                  takenMethods={paymentRows.filter((_, position) => position !== index).map((other) => other.medio).filter(Boolean)}
                  canRemove={paymentRows.length > 1}
                  showActionSlot={showActionSlot}
                  showErrors={showErrors}
                  onChange={(changes) => updateRow(index, changes)}
                  onRemove={() => removeRow(index)}
                />
              ))}
            </div>
            {showErrors && formErrors.medios && <p className="text-sm text-error font-medium" role="alert">{formErrors.medios}</p>}
            {formErrors.montos && <p className="text-sm text-error font-medium" role="alert">{formErrors.montos}</p>}
          </FormSection>

          <FormSection icon="notes" title="Observaciones" disabled={!socio} className="mt-auto">
            <input
              type="text"
              value={observacion}
              onChange={(event) => setObservacion(event.target.value)}
              maxLength={200}
              placeholder="Detalle adicional del pago (opcional)"
              aria-label="Observaciones"
              className={claseInput(false)}
            />
          </FormSection>
        </div>

        <div className={`${TICKET_CLASS} transition-opacity ${socio ? '' : 'opacity-50'}`} role="region" aria-labelledby="payment-summary-title" aria-disabled={!socio || undefined}>
          <h3 id="payment-summary-title" className="text-lg font-bold text-on-surface">Resumen del cobro</h3>

          <div className="flex flex-1 flex-col justify-between gap-3">
            <TicketSection title="Cuotas a cancelar">
              {coveredLines.length
                ? coveredLines.map((line) => (
                  <div key={line.cuota.cuota_id} className="flex flex-col">
                    <SummaryLine label={`Cuota ${formatPeriod(line.cuota.periodo)}`} value={formatAmount(roundCents(line.applied + line.fee))} />
                    {line.applied < line.due && <span className="text-xs text-on-surface-variant">Pago parcial · quedan {formatAmount(roundCents(line.due - line.applied))}</span>}
                  </div>
                ))
                : <p className="text-base text-on-surface-variant">Ingresá el pago para ver las cuotas que cancela.</p>}
            </TicketSection>

            {waivedLines.length > 0 && (
              <TicketSection title="Descuentos / condonación">
                {waivedLines.map((line) => (
                  <SummaryLine
                    key={line.cuota.cuota_id}
                    label={`Condonación recargo ${formatPeriod(line.cuota.periodo)}`}
                    value={`− ${formatAmount(line.fee)}`}
                    valueClassName="text-emerald-700"
                  />
                ))}
              </TicketSection>
            )}

            <div className="pb-3 border-b border-dashed border-slate-300">
              <SummaryLine label="Total de cuotas" value={formatAmount(chargeTotal)} isTotal />
            </div>

            <TicketSection title="Medios de pago ingresados">
              {paymentRows.some(isRowComplete)
                ? paymentRows.filter(isRowComplete).map((row) => (
                  <SummaryLine key={row.medio} label={methodLabel(row.medio)} value={formatAmount(Number(row.monto))} />
                ))
                : <p className="text-base text-on-surface-variant">Ningún medio de pago cargado.</p>}
              <SummaryLine label="Total pagado" value={formatAmount(enteredTotal)} />
            </TicketSection>

            <SummaryLine
              label="Saldo pendiente"
              value={formatAmount(Math.max(pendingBalance, 0))}
              isTotal
              valueClassName={pendingBalance <= 0 ? 'text-emerald-700' : 'text-amber-700'}
            />
          </div>

          <div className="flex flex-col gap-3">
            {submitError && (
              <div className="bg-error-container text-on-error-container p-3 rounded-lg border border-error/30 flex items-start gap-2.5" role="alert">
                <span className="material-symbols-outlined text-base text-error shrink-0" aria-hidden="true">error</span>
                <div>
                  <p className="text-base font-bold">No se pudo registrar el pago</p>
                  <p className="text-sm text-on-error-container/80 mt-0.5 break-words">{submitError}</p>
                </div>
              </div>
            )}
            <button
              type="submit"
              disabled={!socio || saving || noDebt || exceedsDebt || !(enteredTotal > 0)}
              className={`${SUBMIT_BUTTON_CLASS} w-full h-11 justify-center text-base`}
            >
              <span>{confirmLabel()}</span>
            </button>
          </div>
        </div>
      </div>

      <LateFeeWaiverModal
        opened={Boolean(waiverPrompt)}
        cuota={waiverPrompt?.cuota ?? null}
        amount={waiverPrompt?.cuota ? unpaidLateFee(waiverPrompt.cuota) : 0}
        initial={waiver}
        onConfirm={confirmWaiver}
        onClose={() => setWaiverPrompt(null)}
      />
    </form>
  )
}

export default PagoForm
