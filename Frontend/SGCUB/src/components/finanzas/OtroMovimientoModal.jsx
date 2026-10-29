import { useState } from 'react'
import { Modal } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { formatAmount, formatDate, formatDni, formatNumber, getErrorMessage } from '../personas/format'
import { SecondaryButton } from '../personas/tabs/parts'
import { claseInput } from '../socios/socioForm'
import { SelectConAlta, SelectConFlecha } from '../socios/SocioFormFields'
import AuthorizationModal from './AuthorizationModal'
import ComprobantePago from './ComprobantePago'
import DownloadComprobanteButtom from './DownloadComprobanteButtom'
import SocioPicker from './SocioPicker'
import { PaymentRow } from './PagoForm'
import { INCOME, MANUAL_REFUND, isOtherConcept } from './conceptOrigins'
import { registrarIngreso } from '../../api/pagos'
import { registrarDevolucionManual } from '../../api/devoluciones'
import useConceptosMovimiento from '../../hooks/useConceptosMovimiento'
import useMediosPago from '../../hooks/useMediosPago'
import { FormSection, NO_SPINNER_CLASS, SUBMIT_BUTTON_CLASS, SummaryLine, TICKET_CLASS, TicketSection } from './formParts'

const OPERATIONS = [
  {
    value: INCOME,
    title: 'Ingreso',
    description: 'Venta de indumentaria, donación u otro ingreso ajeno a cuotas. No modifica la deuda del socio.',
    icon: 'add_circle',
  },
  {
    value: MANUAL_REFUND,
    title: 'Devolución manual',
    description: 'Dinero recibido de más que nunca se registró como ingreso, como una transferencia por un monto mayor.',
    icon: 'remove_circle',
  },
]

const roundCents = (value) => Math.round(value * 100) / 100

const emptyRow = () => ({ medio: '', monto: '' })

const isRowComplete = (row) => Boolean(row.medio) && Number(row.monto) > 0

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

function DevolucionRegistrada({ devolucion, onBack }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-wider font-semibold text-emerald-700">Operación confirmada</p>
          <h2 className="text-2xl font-bold text-on-surface">Comprobante de devolución</h2>
        </div>
        <span className="inline-flex items-center gap-2 text-emerald-700 font-semibold">
          <span className="material-symbols-outlined" aria-hidden="true">verified</span>Registrado
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-surface-container-low border border-outline-variant/30">
        <div><p className="text-sm text-on-surface-variant">Fecha</p><p className="font-semibold text-on-surface">{formatDate(devolucion.fecha)}</p></div>
        <div><p className="text-sm text-on-surface-variant">Comprobante N°</p><p className="font-semibold text-on-surface">{devolucion.codigo}</p></div>
        <div><p className="text-sm text-on-surface-variant">Socio N°</p><p className="font-semibold text-on-surface">{devolucion.socio?.numero_socio}</p></div>
        <div><p className="text-sm text-on-surface-variant">Nombre y apellido</p><p className="font-semibold text-on-surface">{devolucion.socio?.nombre} {devolucion.socio?.apellido}</p></div>
        <div><p className="text-sm text-on-surface-variant">DNI</p><p className="font-semibold text-on-surface">{formatDni(devolucion.socio?.dni)}</p></div>
        <div><p className="text-sm text-on-surface-variant">Responsable</p><p className="font-semibold text-on-surface">{devolucion.responsable}</p></div>
      </div>

      <section className="border border-outline-variant/30 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant/30"><h3 className="font-bold text-on-surface">Detalle de la devolución</h3></div>
        <div className="divide-y divide-outline-variant/20">
          <div className="flex justify-between gap-4 px-4 py-3"><span className="text-on-surface-variant">Concepto</span><strong className="text-on-surface text-right">{devolucion.concepto}</strong></div>
          <div className="flex justify-between gap-4 px-4 py-3"><span className="text-on-surface-variant">{devolucion.medio_de_pago_nombre}</span><strong className="text-on-surface">{formatAmount(devolucion.monto)}</strong></div>
          <div className="flex justify-between gap-4 px-4 py-3 bg-surface-container-low"><strong className="text-on-surface">Total devuelto</strong><strong className="text-lg text-error">{formatAmount(devolucion.monto)}</strong></div>
        </div>
      </section>

      <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
        <DownloadComprobanteButtom devolucionId={devolucion.devolucion_id} />
        <SecondaryButton icon="arrow_back" onClick={onBack}>Volver</SecondaryButton>
      </div>
    </div>
  )
}

function OtroMovimientoForm({ socio = null, initialOperation = INCOME, onCancel, onSuccess }) {
  const [operationValue, setOperationValue] = useState(initialOperation)
  const [selectedConcept, setConcept] = useState('')
  const { concepts, createConcept } = useConceptosMovimiento()
  const { paymentMethods, methodLabel } = useMediosPago()
  const [rows, setRows] = useState([emptyRow()])
  const [detail, setDetail] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const [confirmingRefund, setConfirmingRefund] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [result, setResult] = useState(null)

  const operation = OPERATIONS.find((option) => option.value === operationValue) ?? OPERATIONS[0]
  const isIncome = operationValue === INCOME
  const conceptOptions = concepts
    .filter((c) => c.origen === operationValue)
    .sort((a, b) => isOtherConcept(a.nombre) - isOtherConcept(b.nombre))
  const concept = selectedConcept || conceptOptions[0]?.nombre || ''
  const needsDetail = isOtherConcept(concept)
  // A manual refund goes back through a single method
  const activeRows = isIncome ? rows : rows.slice(0, 1)
  const total = roundCents(activeRows.reduce((sum, row) => sum + Number(row.monto || 0), 0))

  const errors = {
    concept: !concept ? 'Seleccioná un concepto.' : '',
    rows: activeRows.some((row) => !isRowComplete(row)) ? 'Elegí el medio e ingresá un monto mayor a 0.' : '',
    detail: needsDetail && !detail.trim() ? 'Especificá el motivo o detalle del movimiento.' : '',
  }
  const isValid = !Object.values(errors).some(Boolean)
  const finalConcept = (detail.trim() ? `${concept} · ${detail.trim()}` : concept).slice(0, 200)

  const changeOperation = (value) => {
    setOperationValue(value)
    setConcept('')
    setSubmitError('')
  }

  const updateRow = (index, changes) => setRows((current) => current.map((row, position) => (position === index ? { ...row, ...changes } : row)))

  const registerIncome = async () => {
    setSaving(true)
    setSubmitError('')
    try {
      const comprobante = await registrarIngreso({
        socio_id: socio.socio_id,
        concepto: finalConcept,
        monto_total: total,
        medios: activeRows.map((row) => ({ medio_de_pago: row.medio, monto: Number(row.monto) })),
      })
      setResult({ kind: INCOME, comprobante })
      onSuccess?.()
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'No se pudo registrar el ingreso.'))
    } finally {
      setSaving(false)
    }
  }

  const registerRefund = async ({ autorizado_por: responsable }) => {
    const devolucion = await registrarDevolucionManual({
      socio_id: socio.socio_id,
      concepto: finalConcept,
      monto: total,
      medio_de_pago: activeRows[0].medio,
      responsable,
    })
    setConfirmingRefund(false)
    setResult({ kind: MANUAL_REFUND, devolucion })
    onSuccess?.()
  }

  const submit = (event) => {
    event.preventDefault()
    if (!socio) return
    setShowErrors(true)
    if (!isValid) return
    if (isIncome) {
      registerIncome()
    } else {
      setConfirmingRefund(true)
    }
  }

  if (result?.kind === INCOME) {
    return (
      <ComprobantePago
        socio={socio}
        detalle={result.comprobante}
        medios={activeRows.map((row) => ({ medio: methodLabel(row.medio), monto: Number(row.monto) }))}
        montoTotal={total}
        numero={result.comprobante.numero}
        fecha={result.comprobante.fecha_emision}
        onBack={onCancel}
        backLabel="Volver"
      />
    )
  }
  if (result?.kind === MANUAL_REFUND) {
    return <DevolucionRegistrada devolucion={result.devolucion} onBack={onCancel} />
  }

  const confirmLabel = () => {
    if (saving) return 'Registrando...'
    if (!(total > 0)) return 'Ingresá el monto'
    return `${isIncome ? 'Confirmar ingreso' : 'Confirmar devolución'} • ${formatAmount(total)}`
  }

  return (
    <form onSubmit={submit} className="flex flex-col" noValidate>
      <div className={`grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-stretch ${socio ? '' : 'grayscale'}`}>
        <div className="flex flex-col gap-5 min-w-0">
          <FormSection icon="category" title="Tipo de movimiento" disabled={!socio}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {OPERATIONS.map((option) => (
                <OperationOption key={option.value} operation={option} selected={operationValue === option.value} onSelect={changeOperation} />
              ))}
            </div>
          </FormSection>

          <FormSection icon="receipt_long" title="Concepto" disabled={!socio}>
            <SelectConAlta
              key={operationValue}
              id="concepto-movimiento"
              label={isIncome ? 'Concepto del ingreso' : 'Motivo de la devolución'}
              labelNuevo="Concepto nuevo"
              requerido
              error={showErrors ? errors.concept || undefined : undefined}
              bind={{ id: 'concepto-movimiento', value: concept, onChange: (event) => setConcept(event.target.value) }}
              opciones={conceptOptions.map((c) => ({ value: c.nombre, label: c.nombre }))}
              opcionVacia={<option value="" disabled>Seleccioná un concepto...</option>}
              textoAgregar="+ Agregar concepto nuevo..."
              placeholderNuevo={isIncome ? 'Ej: Rifa anual' : 'Ej: Transferencia duplicada'}
              onCrear={async (nombre) => (await createConcept(nombre, operationValue)).nombre}
            />
          </FormSection>

          <FormSection icon="payments" title={isIncome ? 'Formas de cobro' : 'Forma de devolución'} disabled={!socio}>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 text-base font-semibold text-on-surface">
                <span className="flex-1" aria-hidden="true">{isIncome ? 'Medio de pago' : 'Medio de devolución'} <span className="text-error font-bold">*</span></span>
                <span className="w-36 sm:w-48 shrink-0" aria-hidden="true">Monto <span className="text-error font-bold">*</span></span>
                {isIncome && (
                  <div className="w-11 shrink-0 flex justify-center">
                    {rows.length < paymentMethods.length && (
                      <button
                        type="button"
                        onClick={() => setRows((current) => [...current, emptyRow()])}
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
              {isIncome ? activeRows.map((row, index) => (
                <PaymentRow
                  key={index}
                  row={row}
                  index={index}
                  paymentMethods={paymentMethods}
                  takenMethods={activeRows.filter((_, position) => position !== index).map((other) => other.medio).filter(Boolean)}
                  canRemove={activeRows.length > 1}
                  showActionSlot
                  showErrors={showErrors}
                  onChange={(changes) => updateRow(index, changes)}
                  onRemove={() => setRows((current) => current.filter((_, position) => position !== index))}
                />
              )) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <SelectConFlecha
                      value={activeRows[0].medio}
                      onChange={(event) => updateRow(0, { medio: event.target.value })}
                      aria-label="Medio de devolución"
                      conError={showErrors && !activeRows[0].medio}
                    >
                      <option value="">Seleccioná un medio</option>
                      {paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
                    </SelectConFlecha>
                  </div>
                  <div className="relative w-36 sm:w-48 shrink-0">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base text-outline" aria-hidden="true">$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      value={activeRows[0].monto}
                      onChange={(event) => updateRow(0, { monto: event.target.value })}
                      placeholder="0.00"
                      aria-label="Monto a devolver"
                      aria-invalid={(showErrors && !(Number(activeRows[0].monto) > 0)) || undefined}
                      className={claseInput(showErrors && !(Number(activeRows[0].monto) > 0), `${NO_SPINNER_CLASS} pl-7 font-semibold text-right`)}
                    />
                  </div>
                </div>
              )}
            </div>
            {showErrors && errors.rows && <p className="text-sm text-error font-medium" role="alert">{errors.rows}</p>}
          </FormSection>

          <FormSection icon="notes" title="Observaciones" disabled={!socio}>
            <input
              type="text"
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              maxLength={130}
              placeholder={needsDetail ? 'Especificá el motivo o detalle (obligatorio)' : 'Detalle adicional (opcional)'}
              aria-label="Observaciones"
              aria-invalid={(showErrors && Boolean(errors.detail)) || undefined}
              className={claseInput(showErrors && Boolean(errors.detail))}
            />
            {showErrors && errors.detail && <p className="text-sm text-error font-medium" role="alert">{errors.detail}</p>}
          </FormSection>
        </div>

        <div className={`${TICKET_CLASS} transition-opacity ${socio ? '' : 'opacity-50'}`} role="region" aria-labelledby="movement-summary-title" aria-disabled={!socio || undefined}>
          <h3 id="movement-summary-title" className="text-lg font-bold text-on-surface">Resumen del movimiento</h3>

          <div className="flex flex-1 flex-col justify-between gap-3">
            <TicketSection title="Concepto" spread={false}>
              <SummaryLine label="Operación" value={operation.title} />
              <SummaryLine label="Concepto" value={concept || '—'} />
              {detail.trim() && <SummaryLine label="Observación" value={detail.trim()} />}
            </TicketSection>

            <TicketSection title={isIncome ? 'Medios de pago' : 'Medio de devolución'}>
              {activeRows.some(isRowComplete)
                ? activeRows.filter(isRowComplete).map((row) => <SummaryLine key={row.medio} label={methodLabel(row.medio)} value={formatAmount(Number(row.monto))} />)
                : <p className="text-base text-on-surface-variant">Ningún medio cargado.</p>}
            </TicketSection>

            <SummaryLine
              label={isIncome ? 'Total a ingresar' : 'Total a devolver'}
              value={formatAmount(total)}
              isTotal
              valueClassName={isIncome ? 'text-emerald-700' : 'text-error'}
            />
            <p className="text-sm text-on-surface-variant">
              {isIncome
                ? 'Genera un recibo igual al del pago de cuotas, con el concepto en lugar de los períodos.'
                : 'No se registra como ingreso ni modifica la deuda del socio. Al confirmar se pide el responsable.'}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {submitError && (
              <div className="bg-error-container text-on-error-container p-3 rounded-lg border border-error/30 flex items-start gap-2.5" role="alert">
                <span className="material-symbols-outlined text-base text-error shrink-0" aria-hidden="true">error</span>
                <p className="text-sm break-words">{submitError}</p>
              </div>
            )}
            <button type="submit" disabled={!socio || saving || !(total > 0)} className={`${SUBMIT_BUTTON_CLASS} w-full h-11 justify-center text-base`}>
              <span>{confirmLabel()}</span>
            </button>
          </div>
        </div>
      </div>

      <AuthorizationModal
        opened={confirmingRefund}
        title="Confirmar devolución manual"
        description={`Se registra la devolución de ${formatAmount(total)} a ${socio?.apellido ?? ''}, ${socio?.nombre ?? ''} por "${finalConcept}".`}
        confirmLabel="Confirmar devolución"
        confirmIcon="check"
        authorizerLabel="Responsable de la devolución"
        authorizerError="Elegí el responsable de la devolución."
        errorMessage="No se pudo registrar la devolución."
        withReason={false}
        onConfirm={registerRefund}
        onClose={() => setConfirmingRefund(false)}
      />
    </form>
  )
}

function OtroMovimientoModalContent({ opened, onClose, onSuccess, initialSocio = null, initialOperation = INCOME }) {
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
      aria-label="Ingresos y devoluciones"
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
      <OtroMovimientoForm
        key={socio ? socio.socio_id : 'empty'}
        socio={socio}
        initialOperation={initialOperation}
        onCancel={onClose}
        onSuccess={onSuccess}
      />
    </Modal>
  )
}

// Incomes other than cuotas and manual refunds of a socio
function OtroMovimientoModal(props) {
  return <OtroMovimientoModalContent key={props.opened ? 'open' : 'closed'} {...props} />
}

export default OtroMovimientoModal
