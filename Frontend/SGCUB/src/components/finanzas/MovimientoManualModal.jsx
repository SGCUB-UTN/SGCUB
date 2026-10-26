import { useState } from 'react'
import { Modal } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { formatAmount, formatDate, formatDni, formatNumber, getErrorMessage } from '../personas/format'
import { SecondaryButton } from '../personas/tabs/parts'
import { claseInput } from '../socios/socioForm'
import { Campo, SelectConFlecha } from '../socios/SocioFormFields'
import SocioPicker from './SocioPicker'
import DownloadComprobanteButtom from './DownloadComprobanteButtom'
import { crearMovimientoManual } from '../../api/movimientos'
import { FormSection, NO_SPINNER_CLASS, SUBMIT_BUTTON_CLASS, SummaryLine, TICKET_CLASS, TicketSection } from './formParts'

const OPERATIONS = [
  {
    value: 'IngresoManual',
    title: 'Ingreso manual',
    description: 'Venta de indumentaria, donación u otro ingreso ajeno a cuotas.',
    icon: 'add_circle',
    type: 'Abono',
    concepts: [
      'Venta de indumentaria',
      'Donación',
      'Otro ingreso',
    ],
  },
  {
    value: 'Egreso',
    title: 'Egreso / Devolución',
    description: 'Devolución por transferencia duplicada, error en el monto o reintegro.',
    icon: 'remove_circle',
    type: 'Cargo',
    concepts: [
      'Devolución por transferencia duplicada',
      'Devolución por error en monto transferido',
      'Reintegro de gastos',
      'Compra de insumos / Materiales',
      'Otro egreso',
    ],
  },
]

const PAYMENT_METHODS = [
  { value: 'Efectivo', label: 'Efectivo' },
  { value: 'Transferencia', label: 'Transferencia' },
  { value: 'BilleteraVirtual', label: 'Billetera virtual' },
]

const methodLabel = (value) => PAYMENT_METHODS.find((option) => option.value === value)?.label ?? value

const roundCents = (value) => Math.round(value * 100) / 100

function OperationOption({ operation, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(operation.value)}
      aria-pressed={selected}
      className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors cursor-pointer ${selected ? 'border-primary bg-primary/5' : 'border-outline-variant/50 bg-surface-container-lowest hover:bg-surface-container-low'}`}
    >
      <span className={`material-symbols-outlined text-[22px] ${selected ? 'text-primary' : 'text-outline'}`} aria-hidden="true">{operation.icon}</span>
      <span className="flex flex-col min-w-0">
        <span className="text-base font-semibold text-on-surface">{operation.title}</span>
        <span className="text-sm text-on-surface-variant">{operation.description}</span>
      </span>
    </button>
  )
}

function ComprobanteMovimientoManual({ socio, resultado, concept, detail, onBack }) {
  const isEgreso = resultado.origen_manual === 'Egreso'
  const prefix = isEgreso ? 'EGR-X' : 'X'
  const fecha = resultado.fecha ? formatDate(resultado.fecha) : new Date().toLocaleDateString('es-AR')
  const medioNombre = resultado.medio_de_pago_nombre || methodLabel(resultado.medio_de_pago)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-wider font-semibold text-emerald-700">Operación confirmada</p>
          <h2 className="text-2xl font-bold text-on-surface">
            {isEgreso ? 'Comprobante de egreso / devolución' : 'Comprobante de ingreso'}
          </h2>
        </div>
        <span className="inline-flex items-center gap-2 text-emerald-700 font-semibold">
          <span className="material-symbols-outlined">verified</span>Registrado
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-surface-container-low border border-outline-variant/30">
        <div><p className="text-sm text-on-surface-variant">Fecha</p><p className="font-semibold text-on-surface">{fecha}</p></div>
        <div><p className="text-sm text-on-surface-variant">Comprobante N°</p><p className="font-semibold text-on-surface">{prefix} - {resultado.numero_comprobante ?? resultado.movimiento_cuenta_id}</p></div>
        <div><p className="text-sm text-on-surface-variant">Socio N°</p><p className="font-semibold text-on-surface">{socio.numero_socio}</p></div>
        <div><p className="text-sm text-on-surface-variant">Nombre y apellido</p><p className="font-semibold text-on-surface">{socio.nombre} {socio.apellido}</p></div>
        <div><p className="text-sm text-on-surface-variant">DNI</p><p className="font-semibold text-on-surface">{formatDni(socio.dni)}</p></div>
      </div>

      <section className="border border-outline-variant/30 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant/30">
          <h3 className="font-bold text-on-surface">Detalle del movimiento</h3>
        </div>
        <div className="divide-y divide-outline-variant/20">
          <div className="flex justify-between gap-4 px-4 py-3">
            <span className="text-on-surface-variant">Concepto</span>
            <strong className="text-on-surface">{concept}</strong>
          </div>
          <div className="flex justify-between gap-4 px-4 py-3">
            <span className="text-on-surface-variant">{medioNombre}</span>
            <strong className="text-on-surface">{formatAmount(resultado.monto)}</strong>
          </div>
          <div className="flex justify-between gap-4 px-4 py-3 bg-surface-container-low">
            <strong className="text-on-surface">Monto total</strong>
            <strong className={`text-lg ${isEgreso ? 'text-error' : 'text-primary'}`}>
              {formatAmount(resultado.monto)}
            </strong>
          </div>
        </div>
      </section>

      {detail && (
        <div className="p-4 bg-surface-container-low rounded-lg">
          <p className="text-sm text-on-surface-variant">Observación</p>
          <p className="text-on-surface">{detail}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
        <DownloadComprobanteButtom movimientoId={resultado.movimiento_cuenta_id} />
        <SecondaryButton icon="arrow_back" onClick={onBack}>Volver</SecondaryButton>
      </div>
    </div>
  )
}

function MovimientoManualForm({
  socio = null,
  initialOperation = 'IngresoManual',
  onCancel,
  onSuccess,
}) {
  const [operationValue, setOperationValue] = useState(initialOperation)
  const [concept, setConcept] = useState(() => {
    const op = OPERATIONS.find((o) => o.value === initialOperation) || OPERATIONS[0]
    return op.concepts[0]
  })
  const [paymentMethod, setPaymentMethod] = useState('')
  const [amount, setAmount] = useState('')
  const [detail, setDetail] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [createdResult, setCreatedResult] = useState(null)

  const currentOp = OPERATIONS.find((op) => op.value === operationValue) || OPERATIONS[0]
  const isIngreso = operationValue === 'IngresoManual'
  const isOtherConcept = concept === 'Otro ingreso' || concept === 'Otro egreso'
  const enteredAmount = roundCents(Number(amount || 0))

  const handleOperationChange = (newOpValue) => {
    setOperationValue(newOpValue)
    const op = OPERATIONS.find((o) => o.value === newOpValue) || OPERATIONS[0]
    setConcept(op.concepts[0])
    setSubmitError('')
  }

  const methodError = showErrors && !paymentMethod
  const amountError = showErrors && !(enteredAmount > 0)
  const detailError = showErrors && isOtherConcept && !detail.trim()
  const isValid = Boolean(paymentMethod) && enteredAmount > 0 && (!isOtherConcept || Boolean(detail.trim()))

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!socio) return
    setShowErrors(true)
    if (!isValid) return

    const conceptoFinal = detail.trim() ? `${concept} · ${detail.trim()}` : concept

    setSaving(true)
    setSubmitError('')
    try {
      const response = await crearMovimientoManual({
        socio_id: socio.socio_id,
        tipo: currentOp.type,
        origen: currentOp.value,
        concepto: conceptoFinal.slice(0, 200),
        monto: enteredAmount,
        medio_de_pago: paymentMethod,
      })
      setCreatedResult(response)
      onSuccess?.(response)
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'No se pudo registrar el movimiento.'))
    } finally {
      setSaving(false)
    }
  }

  if (createdResult && socio) {
    return (
      <ComprobanteMovimientoManual
        socio={socio}
        resultado={createdResult}
        concept={concept}
        detail={detail.trim()}
        onBack={onCancel}
      />
    )
  }

  const confirmLabel = () => {
    if (saving) return 'Registrando...'
    if (!(enteredAmount > 0)) return 'Ingresá el monto del movimiento'
    return `${isIngreso ? 'Confirmar ingreso' : 'Confirmar devolución'} • ${formatAmount(enteredAmount)}`
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col" noValidate>
      <div className={`grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-stretch ${socio ? '' : 'grayscale'}`}>
        <div className="flex flex-col gap-5 min-w-0">
          <FormSection icon="category" title="Tipo de movimiento" disabled={!socio}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {OPERATIONS.map((op) => (
                <OperationOption
                  key={op.value}
                  operation={op}
                  selected={operationValue === op.value}
                  onSelect={handleOperationChange}
                />
              ))}
            </div>
          </FormSection>

          <FormSection icon="receipt_long" title="Concepto" disabled={!socio}>
            <Campo id="concepto-manual" label="Concepto del movimiento" requerido>
              <SelectConFlecha
                id="concepto-manual"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
              >
                {currentOp.concepts.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </SelectConFlecha>
            </Campo>
          </FormSection>

          <FormSection
            icon="payments"
            title={isIngreso ? 'Forma de cobro' : 'Forma de devolución / egreso'}
            disabled={!socio}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 text-base font-semibold text-on-surface">
                <span className="flex-1" aria-hidden="true">Medio de pago <span className="text-error font-bold">*</span></span>
                <span className="w-36 sm:w-48 shrink-0" aria-hidden="true">Monto <span className="text-error font-bold">*</span></span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <SelectConFlecha
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                    aria-label="Medio de pago"
                    conError={methodError}
                  >
                    <option value="">Seleccioná un medio</option>
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method.value} value={method.value}>
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
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0.00"
                    aria-label="Monto del movimiento"
                    aria-invalid={amountError || undefined}
                    className={claseInput(amountError, `${NO_SPINNER_CLASS} pl-7 font-semibold text-right`)}
                  />
                </div>
              </div>
            </div>
            {(methodError || amountError) && (
              <p className="text-sm text-error font-medium" role="alert">
                Elegí el medio e ingresá un monto mayor a 0.
              </p>
            )}
          </FormSection>

          <FormSection icon="notes" title="Observaciones" disabled={!socio}>
            <input
              type="text"
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              maxLength={130}
              placeholder={
                isOtherConcept
                  ? 'Especificá el motivo o detalle (obligatorio)'
                  : isIngreso
                    ? 'Detalle adicional del ingreso (opcional)'
                    : 'Detalle adicional de la devolución o egreso (opcional)'
              }
              aria-label="Observaciones"
              aria-invalid={detailError || undefined}
              className={claseInput(detailError)}
            />
            {detailError && (
              <p className="text-sm text-error font-medium" role="alert">
                Por favor especificá el motivo o detalle del movimiento.
              </p>
            )}
          </FormSection>
        </div>

        <div
          className={`${TICKET_CLASS} transition-opacity ${socio ? '' : 'opacity-50'}`}
          role="region"
          aria-labelledby="manual-summary-title"
          aria-disabled={!socio || undefined}
        >
          <h3 id="manual-summary-title" className="text-lg font-bold text-on-surface">Resumen del movimiento</h3>

          <div className="flex flex-1 flex-col justify-between gap-3">
            <TicketSection title="Concepto a imputar" spread={false}>
              <SummaryLine label="Operación" value={currentOp.title} />
              <SummaryLine label="Concepto" value={concept} />
              {detail.trim() && <SummaryLine label="Observación" value={detail.trim()} />}
            </TicketSection>

            <TicketSection title="Medios de pago">
              {paymentMethod && enteredAmount > 0 ? (
                <SummaryLine label={methodLabel(paymentMethod)} value={formatAmount(enteredAmount)} />
              ) : (
                <p className="text-base text-on-surface-variant">Ningún medio de pago cargado.</p>
              )}
            </TicketSection>

            <div className="pb-3 border-b border-dashed border-slate-300">
              <SummaryLine label="Total de medios de pago" value={formatAmount(enteredAmount)} isTotal />
            </div>

            <SummaryLine
              label={isIngreso ? 'Total a ingresar' : 'Total a devolver'}
              value={formatAmount(enteredAmount)}
              isTotal
              valueClassName={isIngreso ? 'text-emerald-700' : 'text-error'}
            />
          </div>

          <div className="flex flex-col gap-3">
            {submitError && (
              <div className="bg-error-container text-on-error-container p-3 rounded-lg border border-error/30 flex items-start gap-2.5" role="alert">
                <span className="material-symbols-outlined text-base text-error shrink-0" aria-hidden="true">error</span>
                <div>
                  <p className="text-base font-bold">No se pudo registrar el movimiento</p>
                  <p className="text-sm text-on-error-container/80 mt-0.5 break-words">{submitError}</p>
                </div>
              </div>
            )}
            <button
              type="submit"
              disabled={!socio || saving || !(enteredAmount > 0)}
              className={`${SUBMIT_BUTTON_CLASS} w-full h-11 justify-center text-base`}
            >
              <span>{confirmLabel()}</span>
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}

function MovimientoManualModalContent({
  opened,
  onClose,
  onSuccess,
  initialSocio = null,
  initialOperation = 'IngresoManual',
}) {
  const isMobile = useMediaQuery('(max-width: 640px)')
  const [socio, setSocio] = useState(initialSocio)

  const socioSummary = () => {
    if (socio) {
      return (
        <p className="min-w-0 truncate text-base text-on-surface-variant">
          <span className="text-lg font-bold text-on-surface">{socio.apellido}, {socio.nombre}</span>
          {' '}(DNI {formatDni(socio.dni)} • Socio {formatNumber(socio.numero_socio)})
        </p>
      )
    }
    return <SocioPicker compact onSelect={(selected) => setSocio(selected)} />
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      aria-label="Otros movimientos de caja"
      title={(
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={() => setSocio(null)}
            disabled={!socio}
            className="inline-flex items-center gap-1 shrink-0 px-2 py-1 rounded-md text-sm font-semibold text-primary hover:bg-primary/5 transition-colors cursor-pointer disabled:opacity-50 disabled:grayscale disabled:cursor-default disabled:hover:bg-transparent"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_back</span>
            Elegir otro socio
          </button>
          <span className="h-6 w-px bg-outline-variant/40 shrink-0" aria-hidden="true" />
          <div className="flex-1 min-w-0">{socioSummary()}</div>
        </div>
      )}
      styles={{ header: { gap: 16 }, title: { flex: 1, minWidth: 0 } }}
      size="min(1240px, 95vw)"
      fullScreen={isMobile}
      centered
      padding="lg"
    >
      <MovimientoManualForm
        key={socio ? socio.socio_id : 'empty'}
        socio={socio}
        initialOperation={initialOperation}
        onCancel={onClose}
        onSuccess={onSuccess}
      />
    </Modal>
  )
}

function MovimientoManualModal(props) {
  return <MovimientoManualModalContent key={props.opened ? 'open' : 'closed'} {...props} />
}

export default MovimientoManualModal
