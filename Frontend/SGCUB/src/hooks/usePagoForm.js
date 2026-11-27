import { useEffect, useMemo, useState } from 'react'
import { collectErrorMessages, formatAmount, isActiveStatus } from '../components/personas/format'
import { currentPeriod } from '../components/shared/periodFormat'
import { registrarPago } from '../api/pagos'
import { getComprobante } from '../api/comprobantes'
import useMediosPago from './useMediosPago'
import useRevertPayment from './useRevertPayment'
import {
  EXCESS_CREDIT_NOTE,
  EXCESS_PARTIAL,
  NO_CUOTAS,
  allocate,
  amountInput,
  cuotaDue,
  emptyPaymentRow,
  excessReason,
  firstCuotasTotal,
  fitMethods,
  initialCount,
  isFuture,
  isRowComplete,
  reversalNote,
  roundCents,
  toggleId,
} from '../components/finanzas/pagoFormMath'

export default function usePagoForm({ socio = null, cuenta = null, initialCuotaIds = NO_CUOTAS, reversal = null, onSuccess, onRevertStart, onReverted }) {
  const { openReversal } = useRevertPayment()
  const period = currentPeriod()
  const debtOnly = Boolean(socio) && !isActiveStatus(socio.estado_administrativo_nombre)
  const paymentLimit = cuenta?.periodo_limite_pago ?? (debtOnly ? period : null)
  const pendingCuotas = useMemo(
    () => (cuenta?.cuotas ?? [])
      .filter((cuota) => Number(cuota.saldo_pendiente ?? 0) > 0)
      .filter((cuota) => !paymentLimit || !isFuture(cuota, paymentLimit))
      .sort((a, b) => String(a.periodo).localeCompare(String(b.periodo)) || a.cuota_id - b.cuota_id),
    [cuenta, paymentLimit],
  )
  const dueCount = pendingCuotas.filter((cuota) => !isFuture(cuota, period)).length
  const [suggestedCount] = useState(() => initialCount(pendingCuotas, initialCuotaIds, period))
  const [expandedIds, setExpandedIds] = useState([])
  const [removal, setRemoval] = useState(null)
  const paymentCuotas = pendingCuotas
  const [excessMode, setExcessMode] = useState(() => (
    reversal && reversal.total > firstCuotasTotal(pendingCuotas, pendingCuotas.length) ? EXCESS_CREDIT_NOTE : EXCESS_PARTIAL
  ))
  const [paymentRows, setPaymentRows] = useState(() => (
    reversal ? [] : [emptyPaymentRow(amountInput(firstCuotasTotal(pendingCuotas, suggestedCount)))]
  ))
  const [refundMethod, setRefundMethod] = useState('')
  const [refundReason, setRefundReason] = useState(() => excessReason(reversal))
  const [refundResponsable, setRefundResponsable] = useState('')
  const [observacion, setObservacion] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const { paymentMethods, methodLabel, error: methodsError, loading: methodsLoading, retry: retryMethods } = useMediosPago()

  const debtTotal = firstCuotasTotal(paymentCuotas, dueCount)
  const received = reversal ? roundCents(reversal.total) : 0
  const hasExcess = Boolean(reversal) && received > debtTotal
  const refundsExcess = hasExcess && excessMode === EXCESS_CREDIT_NOTE
  const receivedApplied = refundsExcess ? debtTotal : received
  const excess = refundsExcess ? roundCents(received - receivedApplied) : 0
  const reversalRows = reversal ? fitMethods(reversal.medios, receivedApplied) : []
  const allRows = [...reversalRows, ...paymentRows]

  const enteredTotal = roundCents(allRows.reduce((total, row) => total + Number(row.monto || 0), 0))
  const lines = allocate(paymentCuotas, enteredTotal)
  const coveredLines = lines.filter((line) => line.applied > 0)
  const pendingTotal = roundCents(lines.reduce((total, line) => total + line.due, 0))
  const billedLines = lines.filter((line) => !isFuture(line.cuota, period) || line.applied > 0)
  const billedTotal = roundCents(billedLines.reduce((total, line) => total + line.due, 0))
  const settledLines = coveredLines.filter((line) => line.applied >= line.due)
  const partialLines = coveredLines.filter((line) => line.applied < line.due)
  const pendingBalance = roundCents(billedTotal - enteredTotal)

  const [syncedCuenta, setSyncedCuenta] = useState(cuenta)
  if (cuenta !== syncedCuenta) {
    setSyncedCuenta(cuenta)
    const suggested = amountInput(firstCuotasTotal(pendingCuotas, suggestedCount))
    setPaymentRows((rows) => (rows.length === 1 && !rows[0].edited ? [{ ...rows[0], monto: suggested }] : rows))
  }

  useEffect(() => {
    const suggested = amountInput(firstCuotasTotal(paymentCuotas, suggestedCount))
    setPaymentRows((rows) => (rows.length === 1 && !rows[0].edited ? [{ ...rows[0], monto: suggested }] : rows))
  }, [paymentCuotas, suggestedCount])

  const [syncedHasExcess, setSyncedHasExcess] = useState(hasExcess)
  if (hasExcess !== syncedHasExcess) {
    setSyncedHasExcess(hasExcess)
    if (hasExcess) setPaymentRows([])
  }

  const toggleExpand = (cuotaId) => setExpandedIds((ids) => toggleId(ids, cuotaId))

  const updateRow = (index, changes) => {
    setPaymentRows((rows) => rows.map((row, position) => (position === index ? { ...row, ...changes } : row)))
  }

  const removeRow = (index) => setPaymentRows((rows) => rows.filter((_, position) => position !== index))

  const addRow = () => setPaymentRows((rows) => [...rows, emptyPaymentRow(amountInput(debtTotal - enteredTotal))])

  const canAddRow = !hasExcess && allRows.length < paymentMethods.length
  const addsInRow = reversalRows.length === 0 && paymentRows.length === 1
  const showActionSlot = Boolean(reversal) || canAddRow || paymentRows.length > 1

  const exceedsDebt = enteredTotal > pendingTotal
  const formErrors = {
    medios: allRows.some((row) => !isRowComplete(row)) ? 'Elegí el medio e ingresá el monto de cada pago.' : '',
    montos: exceedsDebt
      ? `El pago no puede superar ${debtOnly ? 'la deuda pendiente' : 'el total de cuotas pendientes, incluidas las futuras'} (${formatAmount(pendingTotal)}).${hasExcess ? ' Devolvé el excedente con una nota de crédito.' : ''}`
      : '',
    devolucion: excess > 0 && (!refundMethod || !refundReason.trim() || !refundResponsable) ? 'Elegí el medio de devolución, el responsable e indicá el motivo de la nota de crédito.' : '',
  }
  const isValid = !Object.values(formErrors).some(Boolean) && coveredLines.length > 0

  const submitPayment = async () => {
    setSaving(true)
    setSubmitError('')
    try {
      const response = await registrarPago({
        socio_id: socio.socio_id,
        cuota_ids: coveredLines.map((line) => line.cuota.cuota_id),
        monto_total: enteredTotal,
        medios: allRows.map((row) => ({ medio_de_pago: row.medio, monto: Number(row.monto) })),
        observacion: observacion || reversalNote(reversal),
        nota_credito: excess > 0
          ? { comprobante_id: reversal.comprobanteId, monto: excess, medio_de_pago: refundMethod, motivo: refundReason.trim(), responsable: refundResponsable }
          : null,
      })
      const comprobanteId = response.comprobante?.comprobante_id
      const detalle = await getComprobante(comprobanteId).catch(() => null)
      setReceipt({
        comprobanteId,
        detalle,
        medios: allRows.map((row) => ({ medio: methodLabel(row.medio), monto: Number(row.monto) })),
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

  const confirmPayment = (event) => {
    event?.preventDefault()
    if (!socio) return
    setShowErrors(true)
    if (!isValid) return
    submitPayment()
  }

  const reloadReceipt = async () => {
    const detalle = await getComprobante(receipt.comprobanteId)
    setReceipt((current) => ({ ...current, detalle }))
  }

  const revertPayment = () => {
    onRevertStart?.()
    openReversal({ comprobanteId: receipt.comprobanteId, onChanged: onReverted })
  }

  const noDebt = !paymentCuotas.some((cuota) => cuotaDue(cuota) > 0)

  const confirmLabel = () => {
    if (saving) return 'Registrando...'
    if (exceedsDebt) return `Excede las cuotas pendientes en ${formatAmount(roundCents(enteredTotal - pendingTotal))}`
    if (!(enteredTotal > 0)) return 'Ingresá el monto del pago'
    if (excess > 0) return 'Confirmar pago y nota de crédito'
    return 'Confirmar pago'
  }

  const canSubmit = Boolean(socio) && !saving && !noDebt && !exceedsDebt && enteredTotal > 0

  return {
    period,
    pendingCuotas,
    expandedIds,
    toggleExpand,
    removal,
    setRemoval,
    excessMode,
    setExcessMode,
    refundMethod,
    setRefundMethod,
    refundReason,
    setRefundReason,
    refundResponsable,
    setRefundResponsable,
    observacion,
    setObservacion,
    showErrors,
    setShowErrors,
    receipt,
    submitError,
    paymentMethods,
    methodLabel,
    methodsError,
    methodsLoading,
    retryMethods,
    debtTotal,
    received,
    hasExcess,
    refundsExcess,
    excess,
    reversalRows,
    paymentRows,
    allRows,
    enteredTotal,
    lines,
    settledLines,
    partialLines,
    pendingBalance,
    updateRow,
    removeRow,
    addRow,
    canAddRow,
    addsInRow,
    showActionSlot,
    formErrors,
    confirmPayment,
    reloadReceipt,
    revertPayment,
    noDebt,
    confirmLabel,
    canSubmit,
  }
}
