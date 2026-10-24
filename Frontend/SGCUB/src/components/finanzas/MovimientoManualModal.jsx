import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { formatAmount, formatDate, formatDni, formatNumber, getErrorMessage } from '../personas/format'
import { claseInput } from '../socios/socioForm'
import { Campo, SelectConFlecha } from '../socios/SocioFormFields'
import SocioPicker from './SocioPicker'
import { crearMovimientoManual, getMovimientos } from '../../api/movimientos'
import {
  FormSection,
  NO_SPINNER_CLASS,
  SUBMIT_BUTTON_CLASS,
  SummaryLine,
  TICKET_CLASS,
  TicketSection,
} from './formParts'

const DETAIL_MAX_LENGTH = 130
const CONCEPT_MAX_LENGTH = 200

const OTHER_CONCEPTS = new Set(['Otro ingreso', 'Otro egreso', 'Otro motivo'])

const OPERATIONS = [
  {
    value: 'IngresoManual',
    title: 'Registrar ingreso',
    shortTitle: 'Ingreso manual',
    description: 'Excedente de pago, donación, indumentaria u otro ingreso ajeno a la cuota.',
    icon: 'add_card',
    type: 'Abono',
    impactLabel: 'Abono a favor',
    submitText: 'Confirmar ingreso',
    tone: 'text-emerald-700',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
    concepts: [
      'Excedente de transferencia / Saldo a favor',
      'Venta de indumentaria',
      'Donación',
      'Evento / Buffet',
      'Alquiler de instalaciones',
      'Otro ingreso',
    ],
  },
  {
    value: 'Egreso',
    title: 'Registrar egreso',
    shortTitle: 'Egreso de caja',
    description: 'Devolución de saldo, reintegro o salida de caja asociada a un socio.',
    icon: 'payments',
    type: 'Cargo',
    impactLabel: 'Cargo en cuenta',
    submitText: 'Registrar egreso',
    tone: 'text-error',
    badgeClass: 'bg-error/10 text-error border-error/20',
    concepts: [
      'Devolución de saldo / Excedente',
      'Reintegro de gastos al socio',
      'Viáticos deportivos',
      'Compra de insumos / Materiales',
      'Otro egreso',
    ],
  },
  {
    value: 'NotaCredito',
    title: 'Nota de crédito',
    shortTitle: 'Nota de crédito',
    description: 'Anulación o devolución total/parcial de un ingreso ya registrado.',
    icon: 'assignment_return',
    type: 'Cargo',
    impactLabel: 'Reversión de ingreso',
    submitText: 'Emitir nota de crédito',
    tone: 'text-primary',
    badgeClass: 'bg-primary/10 text-primary border-primary/20',
    concepts: [
      'Transferencia o cobro duplicado',
      'Devolución parcial / Diferencia de importe',
      'Devolución total de operación',
      'Error de registración',
      'Otro motivo',
    ],
  },
]

const PAYMENT_METHODS = [
  { value: 'Efectivo', label: 'Efectivo', icon: 'payments' },
  { value: 'Transferencia', label: 'Transferencia', icon: 'account_balance' },
  { value: 'BilleteraVirtual', label: 'Billetera virtual', icon: 'account_balance_wallet' },
]

const movementReceiptNumber = (movement) => movement?.numero_comprobante ?? movement?.movimiento_cuenta_id

const buildEmptyForm = (socio = null, reversedMovement = null) => ({
  socio: reversedMovement?.socio ?? socio,
  operation: reversedMovement ? 'NotaCredito' : 'IngresoManual',
  conceptType: reversedMovement ? 'Devolución total de operación' : '',
  detail: reversedMovement
    ? `Ref. Recibo X #${movementReceiptNumber(reversedMovement)} (${reversedMovement.concepto})`.slice(0, DETAIL_MAX_LENGTH)
    : '',
  amount: reversedMovement ? String(reversedMovement.monto) : '',
  paymentMethod: 'Efectivo',
  reversedMovement,
})

const operationFor = (value) => OPERATIONS.find((operation) => operation.value === value) ?? OPERATIONS[0]

const methodLabel = (value) => PAYMENT_METHODS.find((method) => method.value === value)?.label ?? value

const composeConcept = (conceptType, detail) => {
  const cleanType = conceptType.trim()
  const cleanDetail = detail.trim()
  if (!cleanType) return cleanDetail.slice(0, CONCEPT_MAX_LENGTH)
  if (!cleanDetail) return cleanType.slice(0, CONCEPT_MAX_LENGTH)
  return `${cleanType} · ${cleanDetail}`.slice(0, CONCEPT_MAX_LENGTH)
}

function OperationCard({ operation, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(operation.value)}
      aria-pressed={selected}
      className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors cursor-pointer ${
        selected
          ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
          : 'border-outline-variant/50 bg-surface-container-lowest hover:bg-surface-container-low'
      }`}
    >
      <span
        className={`material-symbols-outlined text-[22px] shrink-0 mt-0.5 ${selected ? 'text-primary' : operation.tone}`}
        aria-hidden="true"
      >
        {operation.icon}
      </span>
      <span className="flex flex-col gap-1 min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-base font-semibold text-on-surface">{operation.title}</span>
          <span className={`px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide rounded-full border ${operation.badgeClass}`}>
            {operation.type}
          </span>
        </span>
        <span className="text-sm leading-snug text-on-surface-variant">{operation.description}</span>
      </span>
    </button>
  )
}

function MovementRow({ movement, selected, onSelect }) {
  const paymentLabel = movement.medio_de_pago_nombre || (movement.medio_de_pago ? methodLabel(movement.medio_de_pago) : null)
  return (
    <button
      type="button"
      onClick={() => onSelect(movement)}
      aria-pressed={selected}
      className={`w-full flex items-center justify-between gap-4 px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
        selected ? 'bg-primary/8' : 'bg-surface-container-lowest hover:bg-surface-container-low'
      }`}
    >
      <span className="flex items-center gap-3 min-w-0">
        <span
          className={`material-symbols-outlined text-[20px] shrink-0 ${selected ? 'text-primary' : 'text-outline'}`}
          aria-hidden="true"
        >
          {selected ? 'radio_button_checked' : 'radio_button_unchecked'}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-base text-on-surface truncate">{movement.concepto}</span>
            <span className="px-1.5 py-0.5 rounded bg-surface-container text-xs font-medium text-on-surface-variant">
              X #{movementReceiptNumber(movement)}
            </span>
          </span>
          <span className="block text-sm text-on-surface-variant">
            {formatDate(movement.fecha)}
            {paymentLabel ? ` • ${paymentLabel}` : ''}
          </span>
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-base font-bold tabular-nums text-on-surface">{formatAmount(movement.monto)}</span>
        <span className={`text-xs font-semibold ${selected ? 'text-primary' : 'text-on-surface-variant'}`}>
          {selected ? 'Seleccionado' : 'Elegir ingreso'}
        </span>
      </span>
    </button>
  )
}

function MovimientoManualModal({ opened, initialSocio = null, initialReversedMovement = null, onClose, onSuccess }) {
  const isMobile = useMediaQuery('(max-width: 640px)')
  const [form, setForm] = useState(() => buildEmptyForm(initialSocio, initialReversedMovement))
  const [searchingSocio, setSearchingSocio] = useState(() => !(initialReversedMovement?.socio ?? initialSocio))
  const [movements, setMovements] = useState([])
  const [loadingMovements, setLoadingMovements] = useState(false)
  const [movementsError, setMovementsError] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const socio = form.socio
  const operation = operationFor(form.operation)
  const isCreditNote = form.operation === 'NotaCredito'
  const isOtherConcept = OTHER_CONCEPTS.has(form.conceptType)
  const amount = Number(form.amount)
  const hasValidAmount = Number.isFinite(amount) && amount > 0
  const maxCredit = Number(form.reversedMovement?.monto ?? 0)
  const amountExceedsCredit = isCreditNote && maxCredit > 0 && amount > maxCredit
  const remainingAfterCredit = isCreditNote && maxCredit > 0 && hasValidAmount && !amountExceedsCredit
    ? Math.max(Math.round((maxCredit - amount) * 100) / 100, 0)
    : null
  const finalConcept = composeConcept(form.conceptType, form.detail)

  const availableMovements = useMemo(() => {
    const reversedIds = new Set(movements.map((item) => item.movimiento_revertido).filter(Boolean))
    return movements
      .filter((movement) => (
        movement.tipo_movimiento === 'Abono'
        && movement.origen_manual === 'IngresoManual'
        && !movement.pago
        && !movement.movimiento_revertido
        && !reversedIds.has(movement.movimiento_cuenta_id)
      ))
      .sort((a, b) => b.movimiento_cuenta_id - a.movimiento_cuenta_id)
  }, [movements])

  useEffect(() => {
    if (!opened) return
    setForm(buildEmptyForm(initialSocio, initialReversedMovement))
    setSearchingSocio(!(initialReversedMovement?.socio ?? initialSocio))
    setMovements([])
    setMovementsError('')
    setShowErrors(false)
    setSubmitError('')
  }, [opened, initialSocio, initialReversedMovement])

  useEffect(() => {
    if (!opened || !socio || !isCreditNote) {
      setMovements([])
      setMovementsError('')
      return undefined
    }
    let active = true
    setLoadingMovements(true)
    setMovementsError('')
    getMovimientos(socio.socio_id)
      .then((data) => active && setMovements(Array.isArray(data) ? data : []))
      .catch(() => active && setMovementsError('No se pudieron cargar los ingresos disponibles para devolver.'))
      .finally(() => active && setLoadingMovements(false))
    return () => { active = false }
  }, [opened, socio, isCreditNote])

  const errors = {
    reversedMovement: isCreditNote && !form.reversedMovement ? 'Seleccioná el ingreso original que querés devolver.' : '',
    amount: (() => {
      if (!hasValidAmount) return 'Ingresá un monto mayor a cero.'
      if (amountExceedsCredit) return `El monto no puede superar el ingreso original (${formatAmount(maxCredit)}).`
      return ''
    })(),
    paymentMethod: !isCreditNote && !form.paymentMethod ? 'Seleccioná el medio de pago.' : '',
    conceptType: !form.conceptType ? 'Seleccioná un concepto de la lista.' : '',
    detail: isOtherConcept && !form.detail.trim() ? 'Especificá el detalle para el concepto "Otro".' : '',
  }

  const isValid = Boolean(socio) && Object.values(errors).every((message) => !message)
  const fieldError = (key) => (showErrors ? errors[key] : '')

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setSubmitError('')
  }

  const changeSocio = (nextSocio) => {
    setForm((current) => ({
      ...current,
      socio: nextSocio,
      reversedMovement: null,
      amount: current.operation === 'NotaCredito' ? '' : current.amount,
    }))
    setSearchingSocio(!nextSocio)
    setShowErrors(false)
    setSubmitError('')
  }

  const selectOperation = (value) => {
    setForm((current) => ({
      ...current,
      operation: value,
      conceptType: '',
      detail: '',
      reversedMovement: null,
      amount: '',
    }))
    setShowErrors(false)
    setSubmitError('')
  }

  const selectMovement = (movement) => {
    setForm((current) => ({
      ...current,
      reversedMovement: movement,
      amount: String(movement.monto),
      conceptType: current.conceptType || 'Devolución total de operación',
      detail: current.detail.trim() ? current.detail : `Ref. Recibo X #${movementReceiptNumber(movement)} (${movement.concepto})`.slice(0, DETAIL_MAX_LENGTH),
    }))
    setSubmitError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!socio) return
    setShowErrors(true)
    if (!isValid) return

    setLoading(true)
    setSubmitError('')
    try {
      await crearMovimientoManual({
        socio_id: socio.socio_id,
        tipo: operation.type,
        origen: form.operation,
        concepto: finalConcept,
        monto: form.amount,
        medio_de_pago: isCreditNote ? null : form.paymentMethod,
        movimiento_revertido_id: isCreditNote ? form.reversedMovement.movimiento_cuenta_id : null,
      })
      onSuccess?.()
      onClose()
    } catch (requestError) {
      setSubmitError(getErrorMessage(requestError, 'No se pudo registrar el movimiento.'))
    } finally {
      setLoading(false)
    }
  }

  const confirmLabel = () => {
    if (loading) return 'Registrando...'
    if (amountExceedsCredit) return 'El monto supera el ingreso original'
    if (!hasValidAmount) return 'Ingresá el monto del movimiento'
    return `${operation.submitText} • ${formatAmount(amount)}`
  }

  const modalTitle = (
    <div className="flex items-center gap-4 min-w-0">
      <span className="shrink-0 text-sm uppercase tracking-wider font-semibold text-primary">
        Movimiento de caja
      </span>
      <span className="h-6 w-px bg-outline-variant/40 shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        {socio && !searchingSocio ? (
          <div className="flex items-center justify-between gap-3 min-w-0">
            <p className="min-w-0 truncate text-base text-on-surface-variant">
              <span className="text-lg font-bold text-on-surface">{socio.apellido}, {socio.nombre}</span>
              {' '}(DNI {formatDni(socio.dni)} • Socio {formatNumber(socio.numero_socio)})
            </p>
            <button
              type="button"
              onClick={() => setSearchingSocio(true)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 shrink-0 h-9 px-3 rounded-lg border border-outline-variant/50 bg-surface-container-lowest text-sm font-semibold text-primary hover:bg-primary/5 hover:border-primary/40 transition-colors cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">swap_horiz</span>
              Cambiar socio
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex-1 min-w-0">
              <SocioPicker compact onSelect={changeSocio} />
            </div>
            {socio && (
              <button
                type="button"
                onClick={() => setSearchingSocio(false)}
                className="shrink-0 h-9 px-3 rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <Modal
      opened={opened}
      onClose={() => !loading && onClose()}
      aria-label="Registrar movimiento manual de caja"
      title={modalTitle}
      styles={{ header: { gap: 16 }, title: { flex: 1, minWidth: 0 } }}
      size="min(1160px, 95vw)"
      fullScreen={isMobile}
      centered
      padding="lg"
    >
      <form onSubmit={submit} className="flex flex-col" noValidate>
        <div className={`grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-stretch ${socio ? '' : 'grayscale'}`}>
          <div className="flex flex-col gap-5 min-w-0">
            <FormSection
              icon="category"
              title="Tipo de movimiento"
              description="Elegí la operación para ajustar los conceptos y su impacto en la cuenta corriente."
              disabled={!socio}
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {OPERATIONS.map((item) => (
                  <OperationCard
                    key={item.value}
                    operation={item}
                    selected={form.operation === item.value}
                    onSelect={selectOperation}
                  />
                ))}
              </div>
            </FormSection>

            {isCreditNote && (
              <FormSection
                icon="history"
                title="Ingreso a devolver"
                description="Seleccioná el ingreso original. Podés reintegrar el total o una parte."
                disabled={!socio}
              >
                {loadingMovements && (
                  <div className="flex items-center gap-2.5 p-4 rounded-lg border border-outline-variant/30 bg-surface-container-low text-base text-on-surface-variant" role="status">
                    <span className="material-symbols-outlined text-[20px] animate-spin text-primary" aria-hidden="true">progress_activity</span>
                    <span>Buscando ingresos disponibles del socio...</span>
                  </div>
                )}

                {!loadingMovements && movementsError && (
                  <div className="flex items-start gap-2.5 p-3 rounded-lg border border-error/30 bg-error-container text-on-error-container" role="alert">
                    <span className="material-symbols-outlined text-base text-error shrink-0" aria-hidden="true">error</span>
                    <p className="text-sm">{movementsError}</p>
                  </div>
                )}

                {!loadingMovements && !movementsError && availableMovements.length === 0 && (
                  <p className="text-base text-on-surface-variant text-center py-6 px-4 border border-dashed border-outline-variant/40 rounded-lg">
                    {socio
                      ? 'Este socio no tiene ingresos disponibles para revertir con una nota de crédito.'
                      : 'Seleccioná un socio para ver sus ingresos disponibles.'}
                  </p>
                )}

                {!loadingMovements && availableMovements.length > 0 && (
                  <div className="max-h-52 overflow-y-auto border border-outline-variant/30 rounded-lg divide-y divide-outline-variant/20 bg-surface-container-lowest shadow-xs">
                    {availableMovements.map((movement) => (
                      <MovementRow
                        key={movement.movimiento_cuenta_id}
                        movement={movement}
                        selected={form.reversedMovement?.movimiento_cuenta_id === movement.movimiento_cuenta_id}
                        onSelect={selectMovement}
                      />
                    ))}
                  </div>
                )}

                {fieldError('reversedMovement') && (
                  <p className="text-sm text-error font-medium" role="alert">{errors.reversedMovement}</p>
                )}
              </FormSection>
            )}

            <FormSection
              icon="payments"
              title={isCreditNote ? 'Importe a devolver' : 'Importe y medio de pago'}
              disabled={!socio}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 items-start">
                <Campo
                  id="movimiento-monto"
                  label={isCreditNote ? 'Monto a devolver' : 'Monto'}
                  requerido
                  error={fieldError('amount') || (amountExceedsCredit ? errors.amount : '')}
                >
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base text-outline" aria-hidden="true">$</span>
                    <input
                      id="movimiento-monto"
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      max={isCreditNote && maxCredit ? maxCredit : undefined}
                      step="0.01"
                      value={form.amount}
                      onChange={(event) => update('amount', event.target.value)}
                      placeholder="0.00"
                      aria-invalid={Boolean(fieldError('amount') || amountExceedsCredit) || undefined}
                      className={claseInput(
                        Boolean(fieldError('amount') || amountExceedsCredit),
                        `${NO_SPINNER_CLASS} pl-7 font-semibold text-right`,
                      )}
                    />
                  </div>
                  {isCreditNote && maxCredit > 0 && (
                    <div className="flex items-center justify-between gap-2 text-xs text-on-surface-variant">
                      <span>Máximo disponible: <strong className="text-on-surface">{formatAmount(maxCredit)}</strong></span>
                      {amount !== maxCredit && (
                        <button
                          type="button"
                          onClick={() => update('amount', String(maxCredit))}
                          className="font-semibold text-primary hover:underline cursor-pointer"
                        >
                          Usar total
                        </button>
                      )}
                    </div>
                  )}
                </Campo>

                {!isCreditNote ? (
                  <Campo
                    id="movimiento-medio"
                    label="Medio de pago"
                    requerido
                    error={fieldError('paymentMethod')}
                  >
                    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Medio de pago">
                      {PAYMENT_METHODS.map((method) => {
                        const active = form.paymentMethod === method.value
                        return (
                          <button
                            key={method.value}
                            type="button"
                            onClick={() => update('paymentMethod', method.value)}
                            aria-pressed={active}
                            className={`h-11 px-2 rounded-lg border flex items-center justify-center gap-1.5 text-center transition-colors cursor-pointer ${
                              active
                                ? 'border-primary bg-primary/8 text-primary font-semibold'
                                : 'border-outline-variant/50 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[18px] shrink-0" aria-hidden="true">{method.icon}</span>
                            <span className="text-xs font-semibold leading-tight truncate">{method.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </Campo>
                ) : (
                  <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-outline-variant/30 bg-surface-container-low/60">
                    <span className="text-xs font-semibold uppercase tracking-wider text-outline">Referencia del ingreso</span>
                    {form.reversedMovement ? (
                      <>
                        <p className="text-sm font-semibold text-on-surface truncate">
                          X #{movementReceiptNumber(form.reversedMovement)} · {form.reversedMovement.concepto}
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          Registrado el {formatDate(form.reversedMovement.fecha)} por {formatAmount(maxCredit)}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-on-surface-variant">
                        Elegí un ingreso de la lista superior para precargar su importe.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </FormSection>

            <FormSection
              icon="edit_note"
              title="Concepto y trazabilidad"
              disabled={!socio}
              className="mt-auto"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 items-start">
                <Campo
                  id="movimiento-concepto-tipo"
                  label="Concepto"
                  requerido
                  error={fieldError('conceptType')}
                >
                  <SelectConFlecha
                    id="movimiento-concepto-tipo"
                    value={form.conceptType}
                    onChange={(event) => update('conceptType', event.target.value)}
                    conError={Boolean(fieldError('conceptType'))}
                  >
                    <option value="">Seleccioná un concepto</option>
                    {operation.concepts.map((conceptOption) => (
                      <option key={conceptOption} value={conceptOption}>
                        {conceptOption}
                      </option>
                    ))}
                  </SelectConFlecha>
                </Campo>

                <Campo
                  id="movimiento-detalle"
                  label="Detalle u observación"
                  requerido={isOtherConcept}
                  error={fieldError('detail')}
                >
                  <input
                    id="movimiento-detalle"
                    type="text"
                    maxLength={DETAIL_MAX_LENGTH}
                    value={form.detail}
                    onChange={(event) => update('detail', event.target.value)}
                    placeholder={
                      isOtherConcept
                        ? 'Especificá el motivo del movimiento'
                        : 'Opcional (ej: N° de transferencia, talle, comprobante)'
                    }
                    className={claseInput(Boolean(fieldError('detail')))}
                  />
                </Campo>
              </div>
            </FormSection>
          </div>

          <div
            className={`${TICKET_CLASS} transition-opacity ${socio ? '' : 'opacity-50'}`}
            role="region"
            aria-labelledby="movement-summary-title"
            aria-disabled={!socio || undefined}
          >
            <h3 id="movement-summary-title" className="text-lg font-bold text-on-surface">
              Resumen del movimiento
            </h3>

            <div className="flex flex-1 flex-col justify-between gap-3">
              <TicketSection title="Operación">
                <SummaryLine label="Tipo" value={operation.shortTitle} />
                <SummaryLine label="Efecto en cuenta" value={operation.impactLabel} valueClassName={operation.tone} />
                <SummaryLine
                  label="Socio"
                  value={socio ? `#${formatNumber(socio.numero_socio)}` : '—'}
                />
              </TicketSection>

              <TicketSection title="Concepto">
                {form.conceptType ? (
                  <div className="flex flex-col gap-0.5">
                    <p className="text-base font-semibold text-on-surface">{form.conceptType}</p>
                    {form.detail.trim() && (
                      <p className="text-sm text-on-surface-variant break-words">{form.detail.trim()}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-base text-on-surface-variant">Sin concepto seleccionado.</p>
                )}
              </TicketSection>

              <TicketSection title={isCreditNote ? 'Reversión' : 'Liquidación'}>
                {!isCreditNote ? (
                  <>
                    <SummaryLine
                      label="Medio de pago"
                      value={methodLabel(form.paymentMethod)}
                    />
                    <SummaryLine
                      label="Asiento"
                      value="Cuenta corriente"
                    />
                  </>
                ) : (
                  <>
                    <SummaryLine
                      label="Ingreso original"
                      value={form.reversedMovement ? `X #${movementReceiptNumber(form.reversedMovement)}` : '—'}
                    />
                    <SummaryLine
                      label="Importe original"
                      value={form.reversedMovement ? formatAmount(maxCredit) : '—'}
                    />
                    {remainingAfterCredit !== null && (
                      <SummaryLine
                        label="Alcance"
                        value={remainingAfterCredit === 0 ? 'Total' : 'Parcial'}
                      />
                    )}
                    {remainingAfterCredit !== null && remainingAfterCredit > 0 && (
                      <SummaryLine
                        label="Saldo del ingreso"
                        value={formatAmount(remainingAfterCredit)}
                      />
                    )}
                  </>
                )}
              </TicketSection>

              <div className="flex flex-col gap-1">
                <SummaryLine
                  label={isCreditNote ? 'Total a devolver' : 'Importe total'}
                  value={hasValidAmount ? formatAmount(amount) : formatAmount(0)}
                  isTotal
                  valueClassName={hasValidAmount ? operation.tone : ''}
                />
                <p className="text-sm text-on-surface-variant">
                  {operation.type === 'Abono'
                    ? form.conceptType === 'Excedente de transferencia / Saldo a favor'
                      ? 'Acredita saldo a favor en la cuenta corriente del socio.'
                      : 'Registra el ingreso en caja asociado a la cuenta del socio.'
                    : isCreditNote
                      ? 'Descuenta el importe devuelto sobre el ingreso original.'
                      : 'Registra el cargo correspondiente en la cuenta corriente.'}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {submitError && (
                <div className="bg-error-container text-on-error-container p-3 rounded-lg border border-error/30 flex items-start gap-2.5" role="alert">
                  <span className="material-symbols-outlined text-base text-error shrink-0" aria-hidden="true">error</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold">No se pudo registrar el movimiento</p>
                    <p className="text-sm text-on-error-container/80 mt-0.5 break-words">{submitError}</p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={!socio || loading || amountExceedsCredit}
                className={`${SUBMIT_BUTTON_CLASS} w-full h-11 justify-center text-base`}
              >
                <span>{confirmLabel()}</span>
              </button>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  )
}

export default MovimientoManualModal
